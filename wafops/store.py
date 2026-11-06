"""SQLite record of exception decisions and applied changes."""

import json
import sqlite3
from datetime import date
from pathlib import Path

from wafops.errors import ProtectionError, WafopsError
from wafops.false_positive import Proposal
from wafops.models import ExceptionRule


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._conn = sqlite3.connect(path)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS proposals (
                id TEXT PRIMARY KEY,
                site TEXT NOT NULL,
                rule_id TEXT NOT NULL,
                ruleset_id TEXT NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                count INTEGER NOT NULL,
                reason TEXT NOT NULL,
                accepted INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_on TEXT NOT NULL,
                expires_on TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                at TEXT NOT NULL,
                site TEXT NOT NULL,
                summary TEXT NOT NULL,
                detail TEXT NOT NULL
            );
            """
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def save_proposals(self, site: str, proposals: list[Proposal], today: date) -> None:
        for item in proposals:
            self._conn.execute(
                """
                INSERT INTO proposals (
                    id, site, rule_id, ruleset_id, method, path, count, reason,
                    accepted, status, created_on, expires_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    count = excluded.count,
                    reason = excluded.reason,
                    accepted = excluded.accepted,
                    expires_on = excluded.expires_on,
                    status = excluded.status
                WHERE proposals.status != 'approved'
                """,
                (
                    item.id,
                    site,
                    item.rule_id,
                    item.ruleset_id,
                    item.method,
                    item.path,
                    item.count,
                    item.reason,
                    int(item.accepted),
                    "pending" if item.accepted else "rejected",
                    today.isoformat(),
                    item.expires_on,
                ),
            )
        self._conn.commit()

    def approve(self, site: str, proposal_id: str) -> ExceptionRule:
        row = self._get(proposal_id)
        if row is None or row["site"] != site:
            raise WafopsError("その例外候補はありません。先に propose を実行します。")
        if not row["accepted"]:
            raise ProtectionError("入れないと判定した候補は承認できません")
        self._conn.execute("UPDATE proposals SET status = 'approved' WHERE id = ?", (proposal_id,))
        self._conn.commit()
        return _exception(self._get(proposal_id))

    def active_exceptions(self, site: str, today: date) -> list[ExceptionRule]:
        rows = self._conn.execute(
            """
            SELECT * FROM proposals
            WHERE site = ? AND status = 'approved' AND expires_on >= ?
            ORDER BY id
            """,
            (site, today.isoformat()),
        ).fetchall()
        return [_exception(row) for row in rows]

    def list_proposals(self, site: str) -> list[sqlite3.Row]:
        return self._conn.execute(
            "SELECT * FROM proposals WHERE site = ? ORDER BY id",
            (site,),
        ).fetchall()

    def add_audit(self, site: str, summary: str, detail: dict, at: str) -> None:
        self._conn.execute(
            "INSERT INTO audit (at, site, summary, detail) VALUES (?, ?, ?, ?)",
            (at, site, summary, json.dumps(detail, ensure_ascii=False)),
        )
        self._conn.commit()

    def audits_for_month(self, site: str, month: str) -> list[sqlite3.Row]:
        return self._conn.execute(
            "SELECT * FROM audit WHERE site = ? AND substr(at, 1, 7) = ? ORDER BY id",
            (site, month),
        ).fetchall()

    def _get(self, proposal_id: str):
        return self._conn.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone()


def _exception(row) -> ExceptionRule:
    return ExceptionRule(
        id=row["id"],
        rule_id=row["rule_id"],
        ruleset_id=row["ruleset_id"],
        method=row["method"],
        path=row["path"],
        expires_on=row["expires_on"],
        reason=row["reason"],
    )
