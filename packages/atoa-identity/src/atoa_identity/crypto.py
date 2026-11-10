"""Ed25519 helpers built on PyNaCl."""

from __future__ import annotations

import base64

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

DID_PREFIX = "did:atoa:"


def generate_signing_key() -> SigningKey:
    return SigningKey.generate()


def signing_key_from_seed(seed: bytes) -> SigningKey:
    if len(seed) != 32:
        raise ValueError("Ed25519 seed must be exactly 32 bytes")
    return SigningKey(seed)


def public_key_hex(verify_key: VerifyKey) -> str:
    return bytes(verify_key).hex()


def agent_id_from_public_key_hex(public_key_hex_value: str) -> str:
    return f"{DID_PREFIX}{public_key_hex_value.lower()}"


def public_key_hex_from_agent_id(agent_id: str) -> str:
    if not agent_id.startswith(DID_PREFIX):
        raise ValueError(f"agent_id must start with {DID_PREFIX}")
    key_hex = agent_id.removeprefix(DID_PREFIX).lower()
    if len(key_hex) != 64:
        raise ValueError("agent_id public key must be 32-byte hex (64 chars)")
    bytes.fromhex(key_hex)  # validate
    return key_hex


def verify_key_from_hex(public_key_hex_value: str) -> VerifyKey:
    raw = bytes.fromhex(public_key_hex_value.lower())
    if len(raw) != 32:
        raise ValueError("public key must be 32 bytes")
    return VerifyKey(raw)


def sign(message: bytes, signing_key: SigningKey) -> str:
    signed = signing_key.sign(message)
    return base64.urlsafe_b64encode(signed.signature).decode("ascii").rstrip("=")


def verify(message: bytes, signature_b64: str, verify_key: VerifyKey) -> bool:
    padding = "=" * (-len(signature_b64) % 4)
    try:
        signature = base64.urlsafe_b64decode(signature_b64 + padding)
        verify_key.verify(message, signature)
        return True
    except (BadSignatureError, ValueError):
        return False
