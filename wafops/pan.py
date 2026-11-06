"""Find payment-card-shaped numbers in a log sample and mask them."""

import re

from wafops.errors import WafopsError

_DIGITS = re.compile(r"(?<!\d)(\d{13,19})(?!\d)")
_REQUIRED_HEADERS = {"authorization", "cookie"}


def scan_text(text: str) -> list[dict]:
    findings = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for match in _DIGITS.finditer(line):
            number = match.group(1)
            if _luhn(number):
                findings.append({"line": line_no, "length": len(number), "last4": number[-4:]})
    return findings


def check_logging(config: dict) -> list[str]:
    if not isinstance(config, dict):
        raise WafopsError("ログ設定はJSONオブジェクトです")
    problems = []
    if config.get("store_request_body") is not False:
        problems.append("リクエストボディを保存する設定です")
    if config.get("store_cookies") is not False:
        problems.append("Cookieを保存する設定です")
    raw_headers = config.get("redact_headers") or []
    if not isinstance(raw_headers, list):
        raise WafopsError("redact_headers は配列です")
    headers = {str(item).lower() for item in raw_headers}
    missing = _REQUIRED_HEADERS - headers
    if missing:
        problems.append("マスクされていないヘッダ: " + ", ".join(sorted(missing)))
    return problems


def _luhn(number: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(number)):
        digit = int(char)
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0
