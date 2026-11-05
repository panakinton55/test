"""Command line for planning, applying, and reporting a WAF template."""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from wafops.aws import desired_rules as aws_desired_rules
from wafops.aws import merge_rules, update_document
from wafops.cloudflare import CloudflareClient, build_plan, format_plan
from wafops.errors import ProtectionError, WafopsError
from wafops.false_positive import format_proposals, propose
from wafops.models import ExceptionRule
from wafops.pan import check_logging, scan_text
from wafops.report import render_report
from wafops.site import load_site_file
from wafops.store import Store
from wafops.templates import catalog, get_template

JST = timezone(timedelta(hours=9))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="wafops",
        description="顧客名義のWAFへテンプレを適用し、ルール1件の例外と月次報告を作ります。",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    templates = sub.add_parser("templates", help="テンプレ一覧")
    templates.set_defaults(func=cmd_templates)

    show = sub.add_parser("show-template", help="テンプレの中身")
    show.add_argument("name")
    show.set_defaults(func=cmd_show)

    plan = sub.add_parser("plan", help="差分を表示する。ゾーンは変更しません。")
    _add_site(plan)
    plan.add_argument("--current", help="取得済みルールJSON。省略時は空のゾーンとして計算します。")
    plan.set_defaults(func=cmd_plan)

    apply_parser = sub.add_parser("apply", help="Cloudflareへ差分を反映する")
    _add_site(apply_parser)
    apply_parser.add_argument("--yes", action="store_true", help="この指定があるときだけAPIを更新します")
    apply_parser.set_defaults(func=cmd_apply)

    exceptions = sub.add_parser("exceptions", help="ルール1件の例外")
    exception_sub = exceptions.add_subparsers(dest="exception_command", required=True)
    propose_parser = exception_sub.add_parser("propose", help="イベントから例外候補を作る")
    _add_site(propose_parser)
    propose_parser.add_argument("--events", required=True)
    propose_parser.set_defaults(func=cmd_propose)
    approve_parser = exception_sub.add_parser("approve", help="候補を承認する。反映は apply です。")
    _add_site(approve_parser)
    approve_parser.add_argument("--id", required=True)
    approve_parser.set_defaults(func=cmd_approve)
    list_parser = exception_sub.add_parser("list", help="候補と承認の一覧")
    _add_site(list_parser)
    list_parser.set_defaults(func=cmd_list)

    report = sub.add_parser("report", help="月次報告書")
    _add_site(report)
    report.add_argument("--month", required=True, help="YYYY-MM")
    report.add_argument("--events")
    report.add_argument("--logs")
    report.set_defaults(func=cmd_report)

    logs = sub.add_parser("logs", help="ログサンプル")
    logs_sub = logs.add_subparsers(dest="logs_command", required=True)
    scan = logs_sub.add_parser("scan", help="カード番号の形を探す")
    scan.add_argument("--file", required=True)
    scan.set_defaults(func=cmd_scan)

    logging_parser = sub.add_parser("logging", help="ログ保存設定")
    logging_sub = logging_parser.add_subparsers(dest="logging_command", required=True)
    check = logging_sub.add_parser("check", help="ボディとCookieを残さないか確認する")
    check.add_argument("--file", required=True)
    check.set_defaults(func=cmd_logging)

    aws_json = sub.add_parser("aws-json", help="AWS WAFv2の更新JSONを出す")
    _add_site(aws_json)
    aws_json.add_argument("--current", help="aws wafv2 get-web-acl のJSON")
    aws_json.add_argument("--out")
    aws_json.set_defaults(func=cmd_aws)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ProtectionError as exc:
        print(f"拒否: {exc}", file=sys.stderr)
        return 2
    except WafopsError as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1


def cmd_templates(_args) -> int:
    for template in catalog().values():
        print(f"{template.key}\t{template.label}\t{template.summary}")
    return 0


def cmd_show(args) -> int:
    template = get_template(args.name)
    print(f"{template.label}: {template.summary}")
    print("通常操作として例外候補にするパス:")
    for path in template.fp_paths:
        print(f"  {path}")
    print("ルール:")
    for rule in template.rules:
        print(f"  {rule.kind}\t{rule.key}\t{rule.description}")
    return 0


def cmd_plan(args) -> int:
    site = load_site_file(args.site)
    template = get_template(site.template)
    today = _today(args.today)
    if site.provider == "aws":
        rules = aws_desired_rules(template, site.mode)
        print(f"サイト: {site.name}")
        print(f"テンプレート: {template.label}")
        print(f"AWSルール数: {len(rules)}")
        print("適用用のJSONは aws-json が出します。ルール1件の例外はCloudflareで行います。")
        return 0
    current = _load_current(args.current) if args.current else None
    with _store(args.db) as store:
        exceptions = store.active_exceptions(site.name, today)
    plan = build_plan(template, site.mode, current, exceptions)
    print(f"サイト: {site.name}")
    print(f"テンプレート: {template.label}")
    print(f"モード: {site.mode}")
    print(format_plan(plan))
    return 0


def cmd_apply(args) -> int:
    site = load_site_file(args.site)
    if site.provider != "cloudflare":
        raise WafopsError("apply は Cloudflare です。AWSは aws-json の文書を使います。")
    template = get_template(site.template)
    today = _today(args.today)
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    client = CloudflareClient(token)
    with _store(args.db) as store:
        exceptions = store.active_exceptions(site.name, today)
        current = client.fetch_current(site.zone_id or "")
        plan = build_plan(template, site.mode, current, exceptions)
        print(format_plan(plan))
        if not plan.changed:
            return 0
        if not args.yes:
            print("反映するには --yes を付けます。", file=sys.stderr)
            return 2
        for phase in plan.phases:
            if not phase.changed:
                continue
            client.put_entrypoint(site.zone_id or "", phase.phase, phase.rules)
            store.add_audit(
                site.name,
                f"{phase.phase} を更新",
                {"creates": phase.creates, "updates": phase.updates, "deletes": phase.deletes},
                _stamp(args.today),
            )
    print("反映しました。")
    return 0


def cmd_propose(args) -> int:
    site = load_site_file(args.site)
    template = get_template(site.template)
    today = _today(args.today)
    events = _load_events(args.events)
    proposals = propose(
        site.name,
        site.provider,
        template,
        events,
        today,
        site.false_positive_threshold,
        site.known_paths,
    )
    with _store(args.db) as store:
        store.save_proposals(site.name, proposals, today)
    print(format_proposals(proposals))
    print("承認は exceptions approve、ゾーンへの反映は apply --yes です。")
    return 0


def cmd_approve(args) -> int:
    site = load_site_file(args.site)
    with _store(args.db) as store:
        item = store.approve(site.name, args.id)
        store.add_audit(
            site.name,
            f"例外を承認 {item.id}",
            {"method": item.method, "path": item.path, "rule_id": item.rule_id, "expires_on": item.expires_on},
            _stamp(args.today),
        )
    print(f"承認しました: {item.id} 期限 {item.expires_on}")
    print("ゾーンへの反映は apply --yes です。")
    return 0


def cmd_list(args) -> int:
    site = load_site_file(args.site)
    with _store(args.db) as store:
        rows = store.list_proposals(site.name)
    if not rows:
        print("候補はありません。")
        return 0
    for row in rows:
        print(f"{row['status']}\t{row['id']}\t{row['method']} {row['path']}\t期限 {row['expires_on']}\t{row['reason']}")
    return 0


def cmd_report(args) -> int:
    site = load_site_file(args.site)
    template = get_template(site.template)
    month = _month(args.month)
    events = _load_events(args.events) if args.events else []
    findings = None
    if args.logs:
        findings = scan_text(Path(args.logs).read_text(encoding="utf-8"))
    with _store(args.db) as store:
        audits = [
            {"at": row["at"], "summary": row["summary"]}
            for row in store.audits_for_month(site.name, month)
        ]
        exceptions = _exceptions_in_month(store.list_proposals(site.name), month)
    print(
        render_report(
            site_name=site.name,
            template=template,
            mode=site.mode,
            provider=site.provider,
            month=month,
            events=events,
            audits=audits,
            exceptions=exceptions,
            pan_findings=findings,
        )
    )
    return 0


def cmd_scan(args) -> int:
    findings = scan_text(Path(args.file).read_text(encoding="utf-8"))
    if not findings:
        print("カード番号の形はありません。")
        return 0
    for finding in findings:
        print(f"{finding['line']}行目 末尾{finding['last4']}（{finding['length']}桁）")
    return 2


def cmd_logging(args) -> int:
    data = json.loads(Path(args.file).read_text(encoding="utf-8"))
    problems = check_logging(data)
    if problems:
        for problem in problems:
            print(problem)
        return 2
    print("ログ設定はボディとCookieを残さず、authorization と cookie をマスクしています。")
    return 0


def cmd_aws(args) -> int:
    site = load_site_file(args.site)
    if site.provider != "aws":
        raise WafopsError("aws-json は provider が aws のサイト定義で実行します")
    template = get_template(site.template)
    desired = aws_desired_rules(template, site.mode)
    if args.current:
        current = json.loads(Path(args.current).read_text(encoding="utf-8"))
        acl = current.get("WebACL", current)
        merged = merge_rules(acl.get("Rules") or [], desired)
        document = update_document(current, merged)
    else:
        document = {"Rules": merge_rules([], desired), "Region": site.region, "Scope": site.scope}
    text = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"書き出しました: {args.out}")
    else:
        print(text, end="")
    return 0


def _add_site(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--site", required=True)
    parser.add_argument("--db", default=".wafops/state.db")
    parser.add_argument("--today", help="判定日 YYYY-MM-DD。省略時は日本時間の今日")


def _today(value: str | None) -> date:
    if not value:
        return datetime.now(JST).date()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise WafopsError("日付は YYYY-MM-DD です") from exc


def _now() -> str:
    return datetime.now(JST).isoformat(timespec="seconds")


def _stamp(value: str | None) -> str:
    if not value:
        return _now()
    day = _today(value)
    return datetime(day.year, day.month, day.day, 9, 0, tzinfo=JST).isoformat(timespec="seconds")


def _month(value: str) -> str:
    if len(value) != 7 or value[4] != "-":
        raise WafopsError("月は YYYY-MM です")
    year, month = value.split("-")
    if not (year.isdigit() and month.isdigit() and 1 <= int(month) <= 12):
        raise WafopsError("月は YYYY-MM です")
    return value


def _load_current(path: str) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise WafopsError("現状JSONはオブジェクトです")
    current = {}
    for phase in (
        "http_request_firewall_custom",
        "http_ratelimit",
        "http_request_firewall_managed",
    ):
        rules = data.get(phase, [])
        if not isinstance(rules, list):
            raise WafopsError(f"{phase} は配列です")
        current[phase] = rules
    return current


def _load_events(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise WafopsError("イベントは配列です")
    events = []
    for item in data:
        if not isinstance(item, dict):
            raise WafopsError("イベントの各要素はオブジェクトです")
        try:
            events.append(
                {
                    "rule_id": str(item["rule_id"]),
                    "ruleset_id": str(item.get("ruleset_id") or ""),
                    "method": str(item["method"]).upper(),
                    "path": str(item["path"]),
                    "action": str(item.get("action") or "block"),
                    "count": int(item.get("count") or 1),
                    "date": str(item["date"]),
                }
            )
        except KeyError as exc:
            raise WafopsError(f"イベントに {exc.args[0]} がありません") from exc
    return events


def _exceptions_in_month(rows, month: str) -> list[ExceptionRule]:
    found = []
    for row in rows:
        if row["status"] != "approved":
            continue
        if row["created_on"][:7] <= month and row["expires_on"][:7] >= month:
            found.append(
                ExceptionRule(
                    id=row["id"],
                    rule_id=row["rule_id"],
                    ruleset_id=row["ruleset_id"],
                    method=row["method"],
                    path=row["path"],
                    expires_on=row["expires_on"],
                    reason=row["reason"],
                )
            )
    return found


class _store:
    def __init__(self, path: str):
        self._store = Store(Path(path))

    def __enter__(self) -> Store:
        return self._store

    def __exit__(self, exc_type, exc, traceback) -> None:
        self._store.close()
