"""atoa-identity: minimal Ed25519 agent identity and short-lived credentials."""

from atoa_identity.credential import (
    Credential,
    CredentialError,
    CredentialVerificationError,
    hash_request,
    issue_credential,
    verify_credential,
)
from atoa_identity.identity import AgentIdentity, AgentProfile

__all__ = [
    "AgentIdentity",
    "AgentProfile",
    "Credential",
    "CredentialError",
    "CredentialVerificationError",
    "hash_request",
    "issue_credential",
    "verify_credential",
]

__version__ = "0.1.0"
