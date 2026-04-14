from __future__ import annotations

import json
import socket
from urllib import error, request

from django.conf import settings


class LLMServiceError(Exception):
    pass


class OpenAICompatibleChatClient:
    def __init__(self, base_url: str | None = None, model: str | None = None, timeout: int | None = None):
        self.base_url = (base_url or settings.LLM_BASE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    def complete_chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 600,
        extra_body: dict | None = None,
    ) -> str:
        body = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if extra_body:
            body.update(extra_body)

        payload = json.dumps(body).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LLMServiceError(f"Local LLM service returned HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise LLMServiceError(f"Unable to reach the local LLM service: {exc.reason}") from exc
        except (TimeoutError, socket.timeout) as exc:
            raise LLMServiceError("The local LLM service timed out before returning a response.") from exc

        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, AttributeError) as exc:
            raise LLMServiceError(f"Unexpected local LLM response payload: {data}") from exc
