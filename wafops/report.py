"""Japanese monthly operating report."""

from wafops.models import ExceptionRule
from wafops.templates import Template


def render_report(
    *,
    site_name: str,
    template: Template,
    mode: str,
    month: str,
    events: list[dict],
    audits: list[dict],
    exceptions: list[ExceptionRule],
    pan_findings: list[dict] | None,
    provider: str = "cloudflare",
) -> str:
    year, month_number = month.split("-")
    in_month = [event for event in events if str(event.get("date", "")).startswith(month)]
    counts: dict[str, int] = {}
    for event in in_month:
        if event.get("action", "block") != "block":
            continue
        rule_id = str(event.get("rule_id") or "unknown")
        counts[rule_id] = counts.get(rule_id, 0) + int(event.get("count") or 0)
    managed = "AWSのマネージドルールグループ" if provider == "aws" else "Cloudflare Managed Ruleset"
    lines = [
        "# WAF月次報告書",
        "",
        f"- サイト: {site_name}",
        f"- 対象: {year}年{int(month_number)}月（日本時間）",
        f"- テンプレート: {template.label}",
        f"- モード: {mode}",
        "",
        "## 有効な防御",
        "",
        f"- {managed}",
    ]
    for rule in template.rules:
        kind = "レート制限" if rule.kind == "rate" else "遮断"
        lines.append(f"- {kind}: {rule.description}")
    lines.extend(["", "## 承認済みの例外", ""])
    if exceptions:
        for item in exceptions:
            lines.append(f"- {item.method} {item.path} のルール {item.rule_id} を {item.expires_on} までスキップ")
    else:
        lines.append("- なし")
    lines.extend(
        [
            "",
            "例外はマネージドルール1件だけです。機密パスの遮断とレート制限は、例外では外れません。",
            "",
            "## ブロック件数",
            "",
        ]
    )
    if counts:
        lines.append("| ルール | 件数 |")
        lines.append("| --- | --- |")
        for rule_id, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
            lines.append(f"| {rule_id} | {count} |")
    else:
        lines.append("この月のブロックイベントはありません。")
    lines.extend(["", "## 変更履歴", ""])
    if audits:
        for row in audits:
            lines.append(f"- {row['at']} {row['summary']}")
    else:
        lines.append("- この月の変更はありません。")
    lines.extend(["", "## ログのカード番号", ""])
    if pan_findings is None:
        lines.append("ログサンプルは未提出です。")
    elif pan_findings:
        lines.append("カード番号の形が見つかりました。ボディとCookieを保存しない設定に戻します。")
        for finding in pan_findings:
            lines.append(f"- {finding['line']}行目 末尾{finding['last4']}（{finding['length']}桁）")
    else:
        lines.append("提出されたサンプルにカード番号の形はありません。")
    lines.extend(
        [
            "",
            "## この運用に含まれる作業",
            "",
            "平日の誤検知調整、ルールの更新、この月次報告書です。",
            "",
        ]
    )
    return "\n".join(lines)
