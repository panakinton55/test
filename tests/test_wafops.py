import base64
import json
import os
import tempfile
import unittest
import unittest.mock
from datetime import date
from pathlib import Path

from wafops.aws import desired_rules as aws_rules
from wafops.aws import merge_rules, update_document
from wafops.cloudflare import (
    MANAGED_RULESET_ID,
    PHASE_CUSTOM,
    PHASE_MANAGED,
    PHASE_RATE,
    CloudflareClient,
    build_plan,
    exception_payload,
    plan_phase,
)
from wafops.errors import ProtectionError, WafopsError
from wafops.false_positive import propose
from wafops.models import ExceptionRule
from wafops.pan import check_logging, scan_text
from wafops.report import render_report
from wafops.site import load_site
from wafops.store import Store
from wafops.templates import catalog, get_template
from wafops.cli import main

ROOT = Path(__file__).resolve().parents[1]
TODAY = date(2026, 10, 20)
RULE_ID = "d9e350f1b72d4730899c8a420e48a85d"


def empty_current():
    return {PHASE_CUSTOM: [], PHASE_RATE: [], PHASE_MANAGED: []}


def shop(**overrides):
    data = {
        "name": "example-shop",
        "provider": "cloudflare",
        "zone_id": "00000000000000000000000000000000",
        "template": "wordpress",
        "mode": "block",
        "plan": "pro",
    }
    data.update(overrides)
    return load_site(data)


class TemplateTests(unittest.TestCase):
    def test_catalog_fits_pro_and_keeps_probe_paths_blocked(self):
        found = catalog()
        self.assertEqual(set(found), {"corporate", "wordpress", "ecommerce"})
        for template in found.values():
            rate = [rule for rule in template.rules if rule.kind == "rate"]
            custom = [rule for rule in template.rules if rule.kind == "block"]
            self.assertLessEqual(len(rate), 2)
            self.assertLessEqual(len(custom), 5)
            self.assertTrue(any(rule.key == "sensitive-paths" for rule in custom))

    def test_known_path_cannot_reopen_a_blocked_path(self):
        with self.assertRaises(ProtectionError):
            shop(known_paths=["/xmlrpc.php"])

    def test_free_plan_is_refused(self):
        with self.assertRaises(ProtectionError):
            shop(plan="free")

    def test_injected_path_is_refused(self):
        with self.assertRaises(ProtectionError):
            shop(known_paths=['/" or true or "'])


class CloudflarePlanTests(unittest.TestCase):
    def test_plan_preserves_customer_rules_and_uses_one_managed_ruleset(self):
        template = get_template("wordpress")
        current = empty_current()
        current[PHASE_CUSTOM] = [
            {"id": "customer-1", "action": "block", "expression": "true", "description": "agency allow"}
        ]
        plan = build_plan(template, "block", current, [])
        custom, rate, managed = plan.phases
        self.assertEqual(custom.rules[0], {"id": "customer-1"})
        self.assertEqual(custom.preserved, 1)
        self.assertTrue(all("method" not in rule["expression"] for rule in rate.rules))
        self.assertEqual(len(rate.rules), 2)
        executes = [rule for rule in managed.rules if rule["action"] == "execute"]
        self.assertEqual(len(executes), 1)
        self.assertEqual(executes[0]["action_parameters"]["id"], MANAGED_RULESET_ID)
        ours = [rule for rule in custom.rules if rule.get("ref")]
        self.assertTrue(ours)
        self.assertTrue(all(rule["action"] != "skip" for rule in ours))

    def test_second_plan_is_unchanged_after_a_simulated_apply(self):
        template = get_template("corporate")
        first = build_plan(template, "block", empty_current(), [])
        fetched = {}
        for phase in first.phases:
            fetched[phase.phase] = []
            for index, rule in enumerate(phase.rules):
                if "ref" not in rule:
                    fetched[phase.phase].append(
                        {"id": rule["id"], "action": "block", "expression": "true", "description": "theirs"}
                    )
                    continue
                item = json.loads(json.dumps(rule))
                item["id"] = f"gen-{index}"
                item["version"] = "4"
                if item["action"] == "execute":
                    item["action_parameters"]["version"] = "latest"
                if "ratelimit" in item:
                    item["ratelimit"]["requests_to_origin"] = False
                fetched[phase.phase].append(item)
        second = build_plan(template, "block", fetched, [])
        self.assertFalse(second.changed)

    def test_challenge_mode_softens_custom_rules_and_keeps_rate_limits_blocking(self):
        template = get_template("ecommerce")
        plan = build_plan(template, "challenge", empty_current(), [])
        custom = plan.phases[0]
        rate = plan.phases[1]
        self.assertTrue(all(rule["action"] == "managed_challenge" for rule in custom.rules))
        self.assertTrue(all(rule["action"] == "block" for rule in rate.rules))

    def test_customer_managed_ruleset_is_not_deployed_twice(self):
        template = get_template("wordpress")
        exception = ExceptionRule(
            id="exc-1234abcd1234",
            rule_id=RULE_ID,
            ruleset_id=MANAGED_RULESET_ID,
            method="POST",
            path="/wp-admin/admin-ajax.php",
            expires_on="2026-11-19",
            reason="repeat",
        )
        current = empty_current()
        current[PHASE_MANAGED] = [
            {
                "id": "their-skip",
                "action": "skip",
                "expression": "false",
                "action_parameters": {"ruleset": "current"},
            },
            {
                "id": "their-exec",
                "action": "execute",
                "expression": "true",
                "action_parameters": {"id": MANAGED_RULESET_ID, "version": "latest"},
            },
        ]
        plan = build_plan(template, "block", current, [exception])
        managed = plan.phases[2].rules
        self.assertEqual(managed[0], {"id": "their-skip"})
        self.assertEqual(managed[1]["action"], "skip")
        self.assertEqual(managed[1]["action_parameters"], {"rules": {MANAGED_RULESET_ID: [RULE_ID]}})
        self.assertEqual(managed[2], {"id": "their-exec"})
        self.assertEqual(len(managed), 3)

    def test_locked_rule_cannot_be_removed(self):
        with self.assertRaises(ProtectionError):
            plan_phase(
                PHASE_CUSTOM,
                [{"id": "1", "ref": "wafops/locked/sensitive-paths", "action": "block", "expression": "true"}],
                [],
            )

    def test_whole_ruleset_skip_is_rejected(self):
        with self.assertRaises(ProtectionError):
            exception_payload(
                ExceptionRule(
                    "exc-1234abcd1234",
                    RULE_ID,
                    "ffffffffffffffffffffffffffffffff",
                    "POST",
                    "/cart",
                    "2026-11-19",
                    "no",
                )
            )


class ExceptionTests(unittest.TestCase):
    def test_repeated_admin_ajax_block_can_be_approved_and_probe_path_cannot(self):
        template = get_template("wordpress")
        events = [
            {
                "rule_id": RULE_ID,
                "ruleset_id": MANAGED_RULESET_ID,
                "method": "POST",
                "path": "/wp-admin/admin-ajax.php",
                "action": "block",
                "count": 18,
                "date": "2026-10-12",
            },
            {
                "rule_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "ruleset_id": MANAGED_RULESET_ID,
                "method": "GET",
                "path": "/.env",
                "action": "block",
                "count": 40,
                "date": "2026-10-12",
            },
        ]
        proposals = propose("example-shop", "cloudflare", template, events, TODAY, 5, ())
        accepted = [item for item in proposals if item.accepted]
        rejected = [item for item in proposals if not item.accepted]
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0].path, "/wp-admin/admin-ajax.php")
        self.assertEqual(rejected[0].path, "/.env")
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp) / "state.db")
            store.save_proposals("example-shop", proposals, TODAY)
            with self.assertRaises(ProtectionError):
                store.approve("example-shop", rejected[0].id)
            approved = store.approve("example-shop", accepted[0].id)
            active = store.active_exceptions("example-shop", TODAY)
            self.assertEqual([item.id for item in active], [approved.id])
            later = store.active_exceptions("example-shop", date(2026, 12, 1))
            self.assertEqual(later, [])
            plan = build_plan(template, "block", empty_current(), active)
            skip = [rule for rule in plan.phases[2].rules if rule["action"] == "skip"]
            execute = [rule for rule in plan.phases[2].rules if rule["action"] == "execute"]
            self.assertEqual(skip[0]["action_parameters"]["rules"], {MANAGED_RULESET_ID: [RULE_ID]})
            self.assertLess(
                plan.phases[2].rules.index(skip[0]),
                plan.phases[2].rules.index(execute[0]),
            )
            self.assertTrue(all(rule["action"] != "skip" for rule in plan.phases[0].rules + plan.phases[1].rules))
            renewed = propose("example-shop", "cloudflare", template, events, date(2026, 10, 25), 5, ())
            store.save_proposals("example-shop", renewed, date(2026, 10, 25))
            kept = store.active_exceptions("example-shop", date(2026, 10, 25))
            self.assertEqual(kept[0].expires_on, approved.expires_on)
            store.close()

    def test_aws_events_are_not_turned_into_exceptions(self):
        template = get_template("ecommerce")
        proposals = propose(
            "example-shop",
            "aws",
            template,
            [
                {
                    "rule_id": RULE_ID,
                    "ruleset_id": MANAGED_RULESET_ID,
                    "method": "POST",
                    "path": "/checkout",
                    "action": "block",
                    "count": 30,
                }
            ],
            TODAY,
            5,
            (),
        )
        self.assertFalse(proposals[0].accepted)


class ClientTests(unittest.TestCase):
    def test_api_error_does_not_echo_the_token(self):
        token = "secret-token-value"

        def transport(method, url, data, headers):
            self.assertEqual(headers["Authorization"], f"Bearer {token}")
            self.assertIn("/zones/00000000000000000000000000000000/rulesets/phases/", url)
            body = json.dumps({"success": False, "errors": [{"message": f"bad {token}"}]}).encode()
            return 400, body

        client = CloudflareClient(token, transport=transport)
        with self.assertRaises(WafopsError) as caught:
            client.get_entrypoint("00000000000000000000000000000000", PHASE_CUSTOM)
        self.assertNotIn(token, str(caught.exception))

    def test_missing_phase_is_an_empty_ruleset(self):
        def transport(method, url, data, headers):
            return 404, b'{"success": false, "errors": [{"message": "not found"}]}'

        client = CloudflareClient("token", transport=transport)
        self.assertEqual(client.get_entrypoint("ab" * 16, PHASE_RATE), [])


class AwsTests(unittest.TestCase):
    def test_merge_keeps_customer_rules_and_blocks_removal_of_locked_rules(self):
        template = get_template("wordpress")
        desired = aws_rules(template, "block")
        current = [
            {"Name": "agency-geo", "Priority": 4, "Action": {"Allow": {}}},
            {"Name": "wafops-locked-not-in-template", "Priority": 5, "Action": {"Block": {}}},
        ]
        with self.assertRaises(ProtectionError):
            merge_rules(current, desired)
        merged = merge_rules([current[0]], desired)
        self.assertEqual(merged[0]["Name"], "agency-geo")
        self.assertGreater(merged[1]["Priority"], merged[0]["Priority"])
        sensitive = next(rule for rule in merged if rule["Name"] == "wafops-locked-sensitive-paths")
        encoded = sensitive["Statement"]["OrStatement"]["Statements"][0]["ByteMatchStatement"]["SearchString"]
        self.assertEqual(base64.b64decode(encoded).decode(), "/.env")
        author = next(rule for rule in merged if rule["Name"] == "wafops-locked-wp-author-enum")
        self.assertIn("QueryString", author["Statement"]["ByteMatchStatement"]["FieldToMatch"])

    def test_update_document_requires_a_lock_token(self):
        with self.assertRaises(ProtectionError):
            update_document({"WebACL": {"Name": "acl", "Id": "id"}}, [])


class AnalyzeTests(unittest.TestCase):
    def test_block_log_keeps_fixed_controls_and_flags_one_exception(self):
        from wafops.analyze import analyze

        template = get_template("wordpress")
        events = json.loads((ROOT / "examples" / "block-log.json").read_text(encoding="utf-8"))
        findings = analyze("example-shop", "cloudflare", template, events, TODAY, 5, ())
        by_path = {item.path: item for item in findings}
        self.assertEqual(by_path["/.env"].decision, "遮断を維持")
        self.assertEqual(by_path["/.env"].label, "機密ファイルへのアクセス")
        self.assertEqual(by_path["/xmlrpc.php"].decision, "遮断を維持")
        self.assertEqual(by_path["/wp-json/wp/v2/users"].label, "ユーザー一覧の取得")
        self.assertEqual(by_path["/wp-login.php"].label, "ログインの連続試行")
        self.assertEqual(by_path["/wp-admin/admin-ajax.php"].decision, "例外候補")
        self.assertEqual(by_path["/checkout"].decision, "様子を見る")
        self.assertNotIn("union", json.dumps(events).lower())


class ReportTests(unittest.TestCase):
    def test_report_masks_card_numbers_and_counts_only_the_requested_month(self):
        template = get_template("ecommerce")
        text = "ok\ncard 4242424242424242\norder 1234567890123\n"
        findings = scan_text(text)
        self.assertEqual(findings, [{"line": 2, "length": 16, "last4": "4242"}])
        self.assertEqual(check_logging({"store_request_body": False, "store_cookies": False, "redact_headers": ["Cookie"]}), [
            "マスクされていないヘッダ: authorization"
        ])
        report = render_report(
            site_name="example-shop",
            template=template,
            mode="block",
            month="2026-10",
            events=[
                {"rule_id": RULE_ID, "action": "block", "count": 4, "date": "2026-10-02"},
                {"rule_id": RULE_ID, "action": "block", "count": 9, "date": "2026-11-02"},
            ],
            audits=[{"at": "2026-10-20T09:00:00+09:00", "summary": "例外を承認 exc-1"}],
            exceptions=[],
            pan_findings=findings,
        )
        self.assertIn("| " + RULE_ID + " | 4 |", report)
        self.assertNotIn("4242424242424242", report)
        self.assertIn("末尾4242", report)
        self.assertIn("例外を承認", report)
        self.assertIn("機密パスの遮断とレート制限は、例外では外れません", report)


class CliTests(unittest.TestCase):
    def test_plan_propose_approve_and_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp) / "state.db")
            common = ["--site", str(ROOT / "examples" / "shop.json"), "--db", db, "--today", "2026-10-20"]
            self.assertEqual(main(["plan", *common, "--current", str(ROOT / "examples" / "empty.json")]), 0)
            self.assertEqual(
                main(["exceptions", "propose", *common, "--events", str(ROOT / "examples" / "events.json")]),
                0,
            )
            code = main(["exceptions", "approve", *common, "--id", "missing"])
            self.assertEqual(code, 1)
            proposals = Store(Path(db))
            rows = [row for row in proposals.list_proposals("example-shop") if row["accepted"]]
            proposal_id = rows[0]["id"]
            proposals.close()
            self.assertEqual(main(["exceptions", "approve", *common, "--id", proposal_id]), 0)
            stdout = _capture(["report", *common, "--month", "2026-10", "--events", str(ROOT / "examples" / "events.json"), "--logs", str(ROOT / "examples" / "logs.jsonl")])
            self.assertIn("WordPress", stdout)
            self.assertIn("/wp-admin/admin-ajax.php", stdout)
            self.assertNotIn("4242424242424242", stdout)
            with unittest.mock.patch.dict(os.environ, {}, clear=False):
                os.environ.pop("CLOUDFLARE_API_TOKEN", None)
                self.assertEqual(main(["apply", *common]), 1)

    def test_logging_check_passes_the_sample(self):
        self.assertEqual(main(["logging", "check", "--file", str(ROOT / "examples" / "logging.json")]), 0)


def _capture(argv):
    from io import StringIO
    from contextlib import redirect_stdout

    buffer = StringIO()
    with redirect_stdout(buffer):
        status = main(argv)
    if status != 0:
        raise AssertionError(buffer.getvalue())
    return buffer.getvalue()


if __name__ == "__main__":
    unittest.main()
