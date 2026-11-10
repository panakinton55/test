"""SQLite audit log for every allow/deny decision."""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class AuditRecord:
    request_id: str
    decided_at: int
    allowed: bool
    reason_code: str
    message: str
    agent_id: str | None
    method: str
    target_url: str
    route_id: str | None
    details: dict[str, Any]


class AuditLog:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                    request_id TEXT PRIMARY KEY,
                    decided_at INTEGER NOT NULL,
                    allowed INTEGER NOT NULL,
                    reason_code TEXT NOT NULL,
                    message TEXT NOT NULL,
                    agent_id TEXT,
                    method TEXT NOT NULL,
                    target_url TEXT NOT NULL,
                    route_id TEXT,
                    details_json TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_decided_at ON audit_log(decided_at)")
            conn.commit()

    def write(
        self,
        *,
        allowed: bool,
        reason_code: str,
        message: str,
        agent_id: str | None,
        method: str,
        target_url: str,
        route_id: str | None = None,
        details: dict[str, Any] | None = None,
        request_id: str | None = None,
        decided_at: int | None = None,
    ) -> AuditRecord:
        record = AuditRecord(
            request_id=request_id or str(uuid.uuid4()),
            decided_at=int(decided_at if decided_at is not None else time.time()),
            allowed=allowed,
            reason_code=reason_code,
            message=message,
            agent_id=agent_id,
            method=method.upper(),
            target_url=target_url,
            route_id=route_id,
            details=details or {},
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (
                    request_id, decided_at, allowed, reason_code, message,
                    agent_id, method, target_url, route_id, details_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.request_id,
                    record.decided_at,
                    1 if record.allowed else 0,
                    record.reason_code,
                    record.message,
                    record.agent_id,
                    record.method,
                    record.target_url,
                    record.route_id,
                    json.dumps(record.details, ensure_ascii=False, sort_keys=True),
                ),
            )
            conn.commit()
        return record

    def list_recent(self, limit: int = 50) -> list[AuditRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM audit_log
                ORDER BY decided_at DESC, request_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            AuditRecord(
                request_id=row["request_id"],
                decided_at=int(row["decided_at"]),
                allowed=bool(row["allowed"]),
                reason_code=row["reason_code"],
                message=row["message"],
                agent_id=row["agent_id"],
                method=row["method"],
                target_url=row["target_url"],
                route_id=row["route_id"],
                details=json.loads(row["details_json"]),
            )
            for row in rows
        ]
