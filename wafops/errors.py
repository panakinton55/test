"""Errors the operator can act on."""


class WafopsError(Exception):
    """The operation could not finish."""


class ProtectionError(WafopsError):
    """The change would weaken a control the tool keeps in place."""
