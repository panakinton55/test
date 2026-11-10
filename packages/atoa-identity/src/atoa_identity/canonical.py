"""Canonical JSON encoding for deterministic signatures."""

from __future__ import annotations

import json
from typing import Any


def canonical_json_bytes(payload: dict[str, Any]) -> bytes:
    """Serialize a dict to UTF-8 JSON with sorted keys and compact separators.

    This is the only encoding used for signed payloads. Nested dicts are sorted
    recursively by ``json.dumps(sort_keys=True)``.
    """
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
