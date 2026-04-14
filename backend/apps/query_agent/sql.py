from __future__ import annotations

import re

from django.conf import settings
from django.db import connection

from apps.query_agent.schema import ALLOWED_TABLES


FORBIDDEN_SQL_PATTERNS = [
    r"--",
    r"/\*",
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|call|do|execute|vacuum|analyze|refresh|set|reset|show|explain|begin|commit|rollback)\b",
    r"\b(pg_|information_schema)\b",
]


class QueryValidationError(Exception):
    pass


def strip_sql_wrappers(sql: str) -> str:
    stripped = sql.strip()
    fenced_match = re.match(r"^```(?:sql)?\s*(.*?)\s*```$", stripped, re.IGNORECASE | re.DOTALL)
    if fenced_match:
        stripped = fenced_match.group(1).strip()
    return stripped


def normalize_sql(sql: str) -> str:
    stripped = strip_sql_wrappers(sql)
    stripped = re.sub(r"^sql\s*", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    stripped = re.sub(r";+\s*$", "", stripped)
    return stripped


def extract_cte_names(sql: str) -> set[str]:
    return {match.group(1) for match in re.finditer(r"(?:with|,)\s*([a-z_][\w]*)\s+as\s*\(", sql)}


def extract_tables(sql: str) -> set[str]:
    table_names = set()
    for match in re.finditer(r"\b(from|join)\s+([a-z_][\w\.]*)", sql):
        raw_name = match.group(2)
        table_names.add(raw_name.split(".")[-1])
    return table_names


def validate_read_only_sql(sql: str) -> str:
    normalized = normalize_sql(sql)
    lowered = normalized.lower()

    if not normalized:
        raise QueryValidationError("The Query Agent did not produce any SQL.")

    if ";" in normalized:
        raise QueryValidationError("Only single-statement SQL is allowed.")

    if not re.match(r"^(select|with)\b", lowered):
        raise QueryValidationError("Only read-only SELECT queries are allowed.")

    for pattern in FORBIDDEN_SQL_PATTERNS:
        if re.search(pattern, lowered):
            raise QueryValidationError("The generated SQL used forbidden syntax.")

    cte_names = extract_cte_names(lowered)
    referenced_tables = extract_tables(lowered)
    if not referenced_tables:
        raise QueryValidationError("The query must reference at least one allowlisted table.")

    disallowed_tables = referenced_tables - ALLOWED_TABLES - cte_names
    if disallowed_tables:
        raise QueryValidationError(
            f"The query referenced tables outside the allowlist: {', '.join(sorted(disallowed_tables))}."
        )

    return normalized


def apply_default_limit(sql: str) -> str:
    if re.search(r"\blimit\s+\d+\b", sql.lower()):
        return sql
    return f"{sql} LIMIT {settings.QUERY_AGENT_MAX_ROWS}"


def run_query(sql: str) -> tuple[list[str], list[dict]]:
    with connection.cursor() as cursor:
        cursor.execute(apply_default_limit(sql))
        columns = [column[0] for column in cursor.description or []]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return columns, rows
