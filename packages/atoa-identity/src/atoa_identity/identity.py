"""Agent identity: profile + Ed25519 key material."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from nacl.signing import SigningKey

from atoa_identity.crypto import (
    agent_id_from_public_key_hex,
    generate_signing_key,
    public_key_hex,
    signing_key_from_seed,
)


@dataclass(frozen=True)
class AgentProfile:
    """Public, shareable description of an agent (never includes private_key)."""

    agent_id: str
    public_key: str
    capabilities: list[str]
    owner: str
    created_at: int
    key_version: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentProfile:
        return cls(
            agent_id=str(data["agent_id"]),
            public_key=str(data["public_key"]),
            capabilities=[str(c) for c in data.get("capabilities", [])],
            owner=str(data["owner"]),
            created_at=int(data["created_at"]),
            key_version=int(data["key_version"]),
        )


@dataclass
class AgentIdentity:
    """In-memory agent identity holding a private signing key.

    Private keys must never be logged, returned in APIs, or pasted into README
    examples. Prefer ``export_public_profile`` / ``save_public_profile`` for
    anything that leaves the process.
    """

    profile: AgentProfile
    _signing_key: SigningKey = field(repr=False, compare=False)

    @property
    def agent_id(self) -> str:
        return self.profile.agent_id

    @property
    def public_key(self) -> str:
        return self.profile.public_key

    @property
    def capabilities(self) -> list[str]:
        return list(self.profile.capabilities)

    @property
    def owner(self) -> str:
        return self.profile.owner

    @property
    def created_at(self) -> int:
        return self.profile.created_at

    @property
    def key_version(self) -> int:
        return self.profile.key_version

    @classmethod
    def generate(
        cls,
        *,
        owner: str,
        capabilities: list[str] | None = None,
        key_version: int = 1,
        created_at: int | None = None,
    ) -> AgentIdentity:
        signing_key = generate_signing_key()
        pub_hex = public_key_hex(signing_key.verify_key)
        profile = AgentProfile(
            agent_id=agent_id_from_public_key_hex(pub_hex),
            public_key=pub_hex,
            capabilities=list(capabilities or []),
            owner=owner,
            created_at=int(created_at if created_at is not None else time.time()),
            key_version=key_version,
        )
        return cls(profile=profile, _signing_key=signing_key)

    @classmethod
    def from_seed(
        cls,
        seed: bytes,
        *,
        owner: str,
        capabilities: list[str] | None = None,
        key_version: int = 1,
        created_at: int | None = None,
    ) -> AgentIdentity:
        """Restore an identity from a 32-byte Ed25519 seed (for tests / local store)."""
        signing_key = signing_key_from_seed(seed)
        pub_hex = public_key_hex(signing_key.verify_key)
        profile = AgentProfile(
            agent_id=agent_id_from_public_key_hex(pub_hex),
            public_key=pub_hex,
            capabilities=list(capabilities or []),
            owner=owner,
            created_at=int(created_at if created_at is not None else time.time()),
            key_version=key_version,
        )
        return cls(profile=profile, _signing_key=signing_key)

    def export_public_profile(self) -> dict[str, Any]:
        return self.profile.to_dict()

    def save_public_profile(self, path: str | Path) -> None:
        Path(path).write_text(
            json.dumps(self.export_public_profile(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    def seed_bytes(self) -> bytes:
        """Return the 32-byte seed. Caller is responsible for secure storage."""
        return bytes(self._signing_key)

    def save_seed(self, path: str | Path, *, mode: int = 0o600) -> None:
        """Persist seed hex to a local file with restrictive permissions.

        Never commit this file. Never log its contents.
        """
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.seed_bytes().hex() + "\n", encoding="utf-8")
        target.chmod(mode)

    @classmethod
    def load(
        cls,
        seed_path: str | Path,
        profile_path: str | Path,
    ) -> AgentIdentity:
        seed_hex = Path(seed_path).read_text(encoding="utf-8").strip()
        profile = AgentProfile.from_dict(json.loads(Path(profile_path).read_text(encoding="utf-8")))
        identity = cls.from_seed(
            bytes.fromhex(seed_hex),
            owner=profile.owner,
            capabilities=profile.capabilities,
            key_version=profile.key_version,
            created_at=profile.created_at,
        )
        if identity.agent_id != profile.agent_id or identity.public_key != profile.public_key:
            raise ValueError("seed does not match public profile")
        return identity
