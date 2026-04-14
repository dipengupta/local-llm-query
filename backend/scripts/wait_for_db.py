from __future__ import annotations

import os
import time

import psycopg


def main() -> None:
    params = {
        "dbname": os.environ.get("POSTGRES_DB", "local_llm_query"),
        "user": os.environ.get("POSTGRES_USER", "local_llm_query"),
        "password": os.environ.get("POSTGRES_PASSWORD", "local_llm_query"),
        "host": os.environ.get("POSTGRES_HOST", "db"),
        "port": os.environ.get("POSTGRES_PORT", "5432"),
    }

    deadline = time.monotonic() + 60
    while True:
        try:
            with psycopg.connect(**params):
                print("Database is ready.")
                return
        except psycopg.OperationalError as exc:
            if time.monotonic() >= deadline:
                raise SystemExit(f"Database did not become ready in time: {exc}") from exc
            print("Waiting for Postgres to accept connections...")
            time.sleep(2)


if __name__ == "__main__":
    main()
