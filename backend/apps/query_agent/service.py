from __future__ import annotations

import json

from apps.chat.services import OpenAICompatibleChatClient
from apps.query_agent.schema import SCHEMA_DESCRIPTION
from apps.query_agent.sql import QueryValidationError, run_query, validate_read_only_sql


SQL_GENERATION_PROMPT = f"""
You are a database query assistant. Convert the user's question into a single PostgreSQL SELECT query.

Rules:
- Respond with SQL only.
- Use only the allowed schema below.
- Never write data.
- Prefer explicit joins.
- Include a LIMIT when returning non-aggregate row lists.
- If the user asks something outside the schema, return:
SELECT 'UNANSWERABLE' AS reason

Schema:
{SCHEMA_DESCRIPTION}
""".strip()

ANSWER_PROMPT = """
You are the Query Agent. Answer only from the SQL results provided.
If the rows are empty, say the database did not return any matching records.
Do not invent facts outside the result set.
""".strip()


class QueryAgentError(Exception):
    def __init__(self, message: str, *, raw_sql: str | None = None):
        super().__init__(message)
        self.raw_sql = raw_sql


class QueryAgentService:
    def __init__(self, client: OpenAICompatibleChatClient):
        self.client = client

    def answer_question(self, question: str) -> dict:
        raw_sql = self._generate_sql(question)
        if "UNANSWERABLE" in raw_sql.upper():
            raise QueryAgentError(
                "The question could not be mapped to the allowlisted database schema.",
                raw_sql=raw_sql,
            )

        try:
            validated_sql = validate_read_only_sql(raw_sql)
        except QueryValidationError as exc:
            raise QueryAgentError(str(exc), raw_sql=raw_sql) from exc

        columns, rows = run_query(validated_sql)
        answer = self._summarize(question, validated_sql, rows)

        return {
            "answer": answer,
            "raw_sql": raw_sql,
            "sql": validated_sql,
            "columns": columns,
            "rows": rows,
        }

    def _generate_sql(self, question: str) -> str:
        return self.client.complete_chat(
            [
                {"role": "system", "content": SQL_GENERATION_PROMPT},
                {"role": "user", "content": question},
            ],
            temperature=0.0,
            max_tokens=160,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

    def _summarize(self, question: str, sql: str, rows: list[dict]) -> str:
        payload = json.dumps({"question": question, "sql": sql, "rows": rows}, default=str)
        return self.client.complete_chat(
            [
                {"role": "system", "content": ANSWER_PROMPT},
                {"role": "user", "content": payload},
            ],
            temperature=0.2,
            max_tokens=220,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
