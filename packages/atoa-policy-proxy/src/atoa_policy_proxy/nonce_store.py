"""SQLite-backed nonce store to reject credential replay."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path


class NonceStore:
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
                CREATE TABLE IF NOT EXISTS nonces (
                    nonce TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                )
                """
            )
            conn.commit()

    def consume(
        self, *, nonce: str, agent_id: str, expires_at: int, now: int | None = None
    ) -> bool:
        """Return True if nonce is fresh and recorded; False if already seen."""
        current = int(now if now is not None else time.time())
        with self._connect() as conn:
            conn.execute("DELETE FROM nonces WHERE expires_at < ?", (current,))
            try:
                conn.execute(
                    "INSERT INTO nonces(nonce, agent_id, expires_at) VALUES (?, ?, ?)",
                    (nonce, agent_id, expires_at),
                )
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                conn.rollback()
                return False
