# Request And Response Flow

This document explains what happens when you type a message into the UI and wait for a response.

## High-level flow

1. The browser sends a `POST` request to the frontend dev server.
2. The Vite dev server proxies `/api/...` traffic to Django.
3. Django validates the request body and decides whether this is `General` or `Query Agent`.
4. Django calls the local LLM sidecar through its OpenAI-compatible API.
5. For `Query Agent`, Django may call the LLM twice:
   - once to generate SQL
   - once to summarize the returned database rows
6. Django returns JSON to the frontend.
7. React renders the answer, and for `Query Agent` also renders the SQL and row payload.

## Step-by-step path

### 1. The user submits a message in React

The chat form lives in:

- `frontend/src/components/ChatScreen.jsx`

Relevant behavior:

- `General` submits to `/api/chat/general/`
- `Query Agent` submits to `/api/chat/query/`
- `General` sends a `messages` array
- `Query Agent` sends a single `question`

Code reference:

- [frontend/src/components/ChatScreen.jsx](/home/dipen/Desktop/codebases/local-llm-query/frontend/src/components/ChatScreen.jsx)

### 2. The frontend sends JSON

The actual fetch helper is:

- [frontend/src/lib/api.js](/home/dipen/Desktop/codebases/local-llm-query/frontend/src/lib/api.js:1)

What it does:

- sends `POST`
- sets `Content-Type: application/json`
- reads the response body as text first
- tries to parse JSON
- if the response is not OK, surfaces:
  - `detail` from JSON when available
  - otherwise plain text
  - otherwise `Request failed (<status>)`

Why this matters:

- earlier, non-JSON backend errors were collapsing into the generic `Request failed.`
- now the UI can show a more useful backend error

### 3. Vite proxies API calls to Django

The frontend container does not call `localhost:8000` directly. It proxies to the Docker service hostname:

- `http://web:8000`

Code reference:

- [frontend/vite.config.js](/home/dipen/Desktop/codebases/local-llm-query/frontend/vite.config.js)

The Compose env also reflects that runtime target:

- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:55)

### 4. Django receives the API request

The route definitions are:

- [backend/config/urls.py](/home/dipen/Desktop/codebases/local-llm-query/backend/config/urls.py)
- [backend/apps/chat/urls.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/urls.py)

The views are:

- [backend/apps/chat/views.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/views.py:21)
- [backend/apps/chat/views.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/views.py:47)

What happens there:

- request JSON is validated with DRF serializers
- `General` adds a system prompt and calls the LLM
- `Query Agent` passes the user question into the query service

### 5. Django talks to the local LLM runtime

The shared LLM client is:

- [backend/apps/chat/services.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/services.py:14)

It calls:

- `POST {LLM_BASE_URL}/chat/completions`

Default runtime config:

- [backend/config/settings.py](/home/dipen/Desktop/codebases/local-llm-query/backend/config/settings.py:106)
- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:35)

Current defaults:

- `LLM_BASE_URL=http://llm:8000/v1`
- `LLM_MODEL=local-qwen-query`
- `LLM_TIMEOUT_SECONDS=180`

### 6. The llama.cpp sidecar serves the model

The `llm` service is defined in:

- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:65)

What it does:

- starts `ghcr.io/ggml-org/llama.cpp:server`
- loads the GGUF model from `LLAMA_CPP_HF_MODEL`
- serves it under the alias `LLAMA_CPP_ALIAS`
- exposes an OpenAI-compatible API on port `8000` inside the container

Current defaults:

- model: `bartowski/Qwen_Qwen3.5-4B-GGUF:Q4_K_M`
- alias: `local-qwen-query`
- context size: `4096`
- threads: `8`

### 7. General mode request path

For `General`:

1. React sends `messages`
2. Django adds the general system prompt
3. Django calls the LLM with:
   - `temperature=0.4`
   - `max_tokens=220`
   - `chat_template_kwargs.enable_thinking = false`
4. Django returns `{ "answer": "..." }`
5. React renders the assistant message

Code reference:

- [backend/apps/chat/views.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/views.py:14)
- [backend/apps/chat/views.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/views.py:35)

### 8. Query Agent request path

For `Query Agent`:

1. React sends `{ "question": "..." }`
2. Django calls `QueryAgentService.answer_question(...)`
3. The service asks the LLM to generate SQL
4. Django validates that SQL against the read-only allowlist
5. Django executes the SQL against Postgres
6. Django asks the LLM to summarize the rows
7. Django returns:
   - `answer`
   - `sql`
   - `columns`
   - `rows`
8. React renders the answer plus the SQL and returned rows

Code reference:

- [backend/apps/query_agent/service.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/query_agent/service.py:41)
- [backend/apps/query_agent/sql.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/query_agent/sql.py)

Current Query Agent tuning:

- SQL generation:
  - `temperature=0.0`
  - `max_tokens=160`
  - thinking disabled
- answer summarization:
  - `temperature=0.2`
  - `max_tokens=220`
  - thinking disabled

## Startup path

The service startup order is:

1. `db` starts
2. Compose waits for Postgres healthcheck to pass
3. `web` runs `python scripts/wait_for_db.py`
4. `web` runs Django migrations
5. `web` starts Django
6. `frontend` starts Vite
7. `llm` starts `llama.cpp` and loads the model

Relevant config:

- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:2)
- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:18)
- [backend/scripts/wait_for_db.py](/home/dipen/Desktop/codebases/local-llm-query/backend/scripts/wait_for_db.py)

## Important fixes already applied

### Host validation fix

Files:

- [backend/config/settings.py](/home/dipen/Desktop/codebases/local-llm-query/backend/config/settings.py:16)
- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:28)
- [.env.example](/home/dipen/Desktop/codebases/local-llm-query/.env.example:3)

What changed:

- added `web` and `0.0.0.0` to `DJANGO_ALLOWED_HOSTS`

Why:

- Vite proxies to Django using the hostname `web`
- Django was rejecting that host and returning a 400 page instead of JSON

### Slow response fix

Files:

- [backend/config/settings.py](/home/dipen/Desktop/codebases/local-llm-query/backend/config/settings.py:108)
- [docker-compose.yml](/home/dipen/Desktop/codebases/local-llm-query/docker-compose.yml:37)
- [backend/apps/chat/services.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/services.py:20)
- [backend/apps/chat/views.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/chat/views.py:35)
- [backend/apps/query_agent/service.py](/home/dipen/Desktop/codebases/local-llm-query/backend/apps/query_agent/service.py:61)

What changed:

- increased `LLM_TIMEOUT_SECONDS` from `60` to `180`
- reduced token budgets
- disabled Qwen thinking mode
- added cleaner timeout handling

Why:

- on CPU-only hardware, the model was still generating when Django gave up

## Troubleshooting guide

If the UI hangs or errors, check services in this order:

1. `docker compose ps`
2. `docker compose logs -f web`
3. `docker compose logs -f llm`
4. `docker compose logs -f frontend`

Common cases:

- `400` with `Invalid HTTP_HOST header`
  - `DJANGO_ALLOWED_HOSTS` mismatch
- `502` with local LLM timeout
  - model too slow for current timeout / token budget
- `Query Agent` returns SQL validation error
  - generated SQL violated the allowlist or used forbidden syntax
- frontend shows generic request failure
  - backend returned non-JSON or the proxy target was unavailable
