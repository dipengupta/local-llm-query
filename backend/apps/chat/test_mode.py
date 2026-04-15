from __future__ import annotations

from apps.chat.services import LLMServiceError
from apps.query_agent.service import QueryAgentError


def complete_general_chat_for_e2e(messages: list[dict[str, str]]) -> str:
    latest_user_message = ""
    for message in reversed(messages):
        if message["role"] == "user":
            latest_user_message = message["content"].strip()
            break

    if latest_user_message.lower() == "trigger general error":
        raise LLMServiceError("Playwright forced general error.")

    return f"Test reply: {latest_user_message}"


def answer_query_for_e2e(question: str) -> dict:
    normalized_question = question.strip()
    if normalized_question.lower() == "trigger query error":
        raise QueryAgentError("Playwright forced query error.")

    row = {
        "question": normalized_question,
        "length": len(normalized_question),
    }

    return {
        "answer": f"Deterministic query answer for: {normalized_question}",
        "raw_sql": "SELECT :question AS question, char_length(:question) AS length",
        "sql": "SELECT :question AS question, char_length(:question) AS length",
        "columns": ["question", "length"],
        "rows": [row],
    }
