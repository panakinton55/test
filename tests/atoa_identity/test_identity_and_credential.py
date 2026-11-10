from __future__ import annotations

import pytest

from atoa_identity import (
    AgentIdentity,
    CredentialVerificationError,
    hash_request,
    issue_credential,
    verify_credential,
)


def test_generate_agent_id_is_did_atoa_hex() -> None:
    identity = AgentIdentity.generate(owner="alice@example.com", capabilities=["a"])
    assert identity.agent_id.startswith("did:atoa:")
    assert identity.agent_id == f"did:atoa:{identity.public_key}"
    assert len(identity.public_key) == 64


def test_credential_roundtrip_and_verify() -> None:
    identity = AgentIdentity.generate(owner="alice@example.com")
    request_hash = hash_request(method="GET", url="https://api.example.com/x", body=b"")
    cred = issue_credential(
        identity,
        audience="https://proxy.local",
        scopes=["read"],
        request_hash=request_hash,
        ttl_seconds=30,
        now=1_700_000_000,
    )
    verified = verify_credential(
        cred.to_dict(),
        expected_audience="https://proxy.local",
        required_scopes=["read"],
        expected_request_hash=request_hash,
        now=1_700_000_010,
    )
    assert verified.agent_id == identity.agent_id
    assert "private" not in cred.to_dict()
    assert "seed" not in cred.to_dict()


def test_tampered_request_hash_fails() -> None:
    identity = AgentIdentity.generate(owner="alice@example.com")
    good_hash = hash_request(method="GET", url="https://api.example.com/x")
    cred = issue_credential(
        identity,
        audience="https://proxy.local",
        scopes=["read"],
        request_hash=good_hash,
        now=1_700_000_000,
    )
    with pytest.raises(CredentialVerificationError) as exc:
        verify_credential(
            cred,
            expected_audience="https://proxy.local",
            expected_request_hash=hash_request(method="POST", url="https://api.example.com/x"),
            now=1_700_000_000,
        )
    assert exc.value.code == "REQUEST_HASH_MISMATCH"


def test_expired_credential_fails() -> None:
    identity = AgentIdentity.generate(owner="alice@example.com")
    request_hash = hash_request(method="GET", url="https://api.example.com/x")
    cred = issue_credential(
        identity,
        audience="https://proxy.local",
        scopes=["read"],
        request_hash=request_hash,
        ttl_seconds=10,
        now=1_700_000_000,
    )
    with pytest.raises(CredentialVerificationError) as exc:
        verify_credential(
            cred,
            expected_audience="https://proxy.local",
            expected_request_hash=request_hash,
            now=1_700_000_100,
        )
    assert exc.value.code == "EXPIRED"


def test_nonce_replay_detected() -> None:
    identity = AgentIdentity.generate(owner="alice@example.com")
    request_hash = hash_request(method="GET", url="https://api.example.com/x")
    cred = issue_credential(
        identity,
        audience="https://proxy.local",
        scopes=["read"],
        request_hash=request_hash,
        now=1_700_000_000,
        nonce="fixed-nonce",
    )
    seen: set[str] = set()
    verify_credential(cred, expected_request_hash=request_hash, now=1_700_000_000, seen_nonces=seen)
    with pytest.raises(CredentialVerificationError) as exc:
        verify_credential(
            cred,
            expected_request_hash=request_hash,
            now=1_700_000_000,
            seen_nonces=seen,
        )
    assert exc.value.code == "NONCE_REPLAY"


def test_save_and_load_roundtrip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    identity = AgentIdentity.generate(owner="alice@example.com", capabilities=["x"])
    seed_path = tmp_path / "agent.seed"
    profile_path = tmp_path / "agent.json"
    identity.save_seed(seed_path)
    identity.save_public_profile(profile_path)
    loaded = AgentIdentity.load(seed_path, profile_path)
    assert loaded.agent_id == identity.agent_id
    assert "private_key" not in profile_path.read_text(encoding="utf-8")
