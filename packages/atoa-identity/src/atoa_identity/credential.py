"""Short-lived signed credentials for outbound agent requests."""

from __future__ import annotations

import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Any

from atoa_identity.canonical import canonical_json_bytes
from atoa_identity.crypto import (
    public_key_hex_from_agent_id,
    sign,
    verify,
    verify_key_from_hex,
)
from atoa_identity.identity import AgentIdentity

# Fields that MUST be covered by the signature (excluding the signature itself).
SIGNED_FIELDS = (
    "agent_id",
    "key_version",
    "issued_at",
    "expires_at",
    "audience",
    "scopes",
    "nonce",
    "request_hash",
)


class CredentialError(ValueError):
    """Raised when a credential cannot be constructed."""


class CredentialVerificationError(ValueError):
    """Raised when credential verification fails."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True)
class Credential:
    agent_id: str
    key_version: int
    issued_at: int
    expires_at: int
    audience: str
    scopes: tuple[str, ...]
    nonce: str
    request_hash: str
    signature: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "key_version": self.key_version,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "audience": self.audience,
            "scopes": list(self.scopes),
            "nonce": self.nonce,
            "request_hash": self.request_hash,
            "signature": self.signature,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Credential:
        missing = [f for f in (*SIGNED_FIELDS, "signature") if f not in data]
        if missing:
            raise CredentialError(f"credential missing fields: {', '.join(missing)}")
        scopes_raw = data["scopes"]
        if not isinstance(scopes_raw, list):
            raise CredentialError("scopes must be a list")
        return cls(
            agent_id=str(data["agent_id"]),
            key_version=int(data["key_version"]),
            issued_at=int(data["issued_at"]),
            expires_at=int(data["expires_at"]),
            audience=str(data["audience"]),
            scopes=tuple(str(s) for s in scopes_raw),
            nonce=str(data["nonce"]),
            request_hash=str(data["request_hash"]),
            signature=str(data["signature"]),
        )

    def signing_payload(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "key_version": self.key_version,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "audience": self.audience,
            "scopes": list(self.scopes),
            "nonce": self.nonce,
            "request_hash": self.request_hash,
        }


def hash_request(
    *,
    method: str,
    url: str,
    body: bytes | str | None = None,
) -> str:
    """Compute a stable request hash included in the signed credential.

    Format: ``sha256:<hex>`` over ``METHOD\\nURL\\n<body>``.
    """
    body_bytes = b""
    if body is not None:
        body_bytes = body if isinstance(body, bytes) else body.encode("utf-8")
    material = f"{method.upper()}\n{url}\n".encode() + body_bytes
    digest = hashlib.sha256(material).hexdigest()
    return f"sha256:{digest}"


def issue_credential(
    identity: AgentIdentity,
    *,
    audience: str,
    scopes: list[str],
    request_hash: str,
    ttl_seconds: int = 60,
    now: int | None = None,
    nonce: str | None = None,
) -> Credential:
    """Issue a short-lived signed credential for one outbound request."""
    if ttl_seconds <= 0:
        raise CredentialError("ttl_seconds must be positive")
    if not audience:
        raise CredentialError("audience is required")
    if not request_hash.startswith("sha256:") or len(request_hash) != len("sha256:") + 64:
        raise CredentialError("request_hash must be sha256:<64-hex>")
    if not scopes:
        raise CredentialError("at least one scope is required")

    issued_at = int(now if now is not None else time.time())
    unsigned = Credential(
        agent_id=identity.agent_id,
        key_version=identity.key_version,
        issued_at=issued_at,
        expires_at=issued_at + ttl_seconds,
        audience=audience,
        scopes=tuple(scopes),
        nonce=nonce or secrets.token_urlsafe(16),
        request_hash=request_hash,
        signature="",
    )
    message = canonical_json_bytes(unsigned.signing_payload())
    signature = sign(message, identity._signing_key)
    return Credential(
        agent_id=unsigned.agent_id,
        key_version=unsigned.key_version,
        issued_at=unsigned.issued_at,
        expires_at=unsigned.expires_at,
        audience=unsigned.audience,
        scopes=unsigned.scopes,
        nonce=unsigned.nonce,
        request_hash=unsigned.request_hash,
        signature=signature,
    )


def verify_credential(
    credential: Credential | dict[str, Any],
    *,
    public_key: str | None = None,
    expected_audience: str | None = None,
    required_scopes: list[str] | None = None,
    expected_request_hash: str | None = None,
    expected_key_version: int | None = None,
    now: int | None = None,
    max_clock_skew_seconds: int = 30,
    seen_nonces: set[str] | None = None,
) -> Credential:
    """Verify signature, expiry, audience, scopes, request_hash, and optional nonce replay.

    Returns the normalized ``Credential`` on success; raises
    ``CredentialVerificationError`` on failure.
    """
    cred = credential if isinstance(credential, Credential) else Credential.from_dict(credential)
    current = int(now if now is not None else time.time())

    try:
        derived_pk = public_key_hex_from_agent_id(cred.agent_id)
    except ValueError as exc:
        raise CredentialVerificationError("INVALID_AGENT_ID", str(exc)) from exc

    pk = (public_key or derived_pk).lower()
    if pk != derived_pk:
        raise CredentialVerificationError(
            "PUBLIC_KEY_MISMATCH",
            "provided public_key does not match agent_id",
        )

    if expected_key_version is not None and cred.key_version != expected_key_version:
        raise CredentialVerificationError(
            "KEY_VERSION_MISMATCH",
            f"expected key_version {expected_key_version}, got {cred.key_version}",
        )

    if current + max_clock_skew_seconds < cred.issued_at:
        raise CredentialVerificationError("NOT_YET_VALID", "credential issued_at is in the future")

    if current - max_clock_skew_seconds > cred.expires_at:
        raise CredentialVerificationError("EXPIRED", "credential has expired")

    if expected_audience is not None and cred.audience != expected_audience:
        raise CredentialVerificationError(
            "AUDIENCE_MISMATCH",
            f"expected audience {expected_audience!r}, got {cred.audience!r}",
        )

    if expected_request_hash is not None and cred.request_hash != expected_request_hash:
        raise CredentialVerificationError(
            "REQUEST_HASH_MISMATCH",
            "request_hash does not match the presented request",
        )

    if required_scopes:
        missing = [s for s in required_scopes if s not in cred.scopes]
        if missing:
            raise CredentialVerificationError(
                "SCOPE_MISSING",
                f"missing required scopes: {', '.join(missing)}",
            )

    if seen_nonces is not None:
        if cred.nonce in seen_nonces:
            raise CredentialVerificationError("NONCE_REPLAY", "nonce has already been used")
        seen_nonces.add(cred.nonce)

    message = canonical_json_bytes(cred.signing_payload())
    verify_key = verify_key_from_hex(pk)
    if not verify(message, cred.signature, verify_key):
        raise CredentialVerificationError(
            "INVALID_SIGNATURE", "Ed25519 signature verification failed"
        )

    return cred
