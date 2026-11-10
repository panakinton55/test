"""CLI entrypoint: ``atoa-policy-proxy``."""

from __future__ import annotations

import argparse
from pathlib import Path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the atoa policy proxy")
    parser.add_argument(
        "--policy",
        required=True,
        type=Path,
        help="Path to policy YAML/JSON",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("atoa_proxy.db"),
        help="SQLite path for audit/nonce/rate-limit state",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument(
        "--no-forward",
        action="store_true",
        help="Decide only; do not forward to upstream (useful for tests)",
    )
    args = parser.parse_args(argv)

    import uvicorn

    from atoa_policy_proxy.app import create_app

    app = create_app(
        policy_path=args.policy,
        db_path=args.db,
        forward=not args.no_forward,
    )
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
