"""Paths that may appear in a rule or an exception."""

import re

from wafops.errors import ProtectionError

_PATH = re.compile(r"^/[A-Za-z0-9._~/-]*$")


def validate_path(path: str) -> str:
    if not isinstance(path, str) or path != path.strip():
        raise ProtectionError("パスは前後に空白のない文字列です")
    if path == "/":
        raise ProtectionError("サイト全体を一つの例外やルールにしません")
    if not _PATH.fullmatch(path) or len(path) > 120 or ".." in path or "//" in path:
        raise ProtectionError(f"使えないパスです: {path!r}")
    return path
