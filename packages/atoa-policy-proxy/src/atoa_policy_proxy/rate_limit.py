"""Simple sliding-window rate limiter backed by SQLite."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path


class RateLimiter:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rate_events (
                    agent_id TEXT NOT NULL,
                    route_id TEXT NOT NULL,
                    ts INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_rate_lookup ON rate_events(agent_id, route_id, ts)"
            )
            conn.commit()

    def check_and_record(
        self,
        *,
        agent_id: str,
        route_id: str,
        limit: int,
        window_seconds: int,
        now: int | None = None,
    ) -> tuple[bool, int]:
        """Return (allowed, current_count_in_window). Records on allow."""
        current = int(now if now is not None else time.time())
        window_start = current - window_seconds
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM rate_events WHERE ts < ?",
                (window_start,),
            )
            row = conn.execute(
                """
                SELECT COUNT(*) FROM rate_events
                WHERE agent_id = ? AND route_id = ? AND ts >= ?
                """,
                (agent_id, route_id, window_start),
            ).fetchone()
            count = int(row[0]) if row else 0
            if count >= limit:
                conn.commit()
                return False, count
            conn.execute(
                "INSERT INTO rate_events(agent_id, route_id, ts) VALUES (?, ?, ?)",
                (agent_id, route_id, current),
            )
            conn.commit()
            return True, count + 1
