# local-llm-query

`local-llm-query` is a starter project for learning how to run a local LLM in a web app with two modes:

- `General`: normal chat with the local model
- `Query Agent`: database-grounded answers against a Postgres copy of `social-data.sqlite3`

The current app also persists conversation history for both modes and exposes a dashboard in the frontend so saved chats can be reviewed and reopened.

## Stack

- Django + Django REST Framework
- React + Vite
- Postgres
- `llama.cpp` sidecar serving a quantized GGUF model through an OpenAI-compatible API
- Docker Compose for local orchestration

## Layout

- `backend/`: Django project, API, query validation, SQLite import command
- `frontend/`: React SPA
- `docs/implementation-plan.md`: implementation decisions for v1
- `docs/request-response-flow.md`: request flow, runtime behavior, and troubleshooting notes
- `agents.md`: contributor guidance for humans and coding agents

## Key API endpoints

- `GET /api/core/health/`
- `GET /api/chat/turns/`
- `GET /api/chat/conversations/`
- `GET /api/chat/conversations/latest/?mode=<general|query>`
- `GET /api/chat/conversations/<id>/`
- `POST /api/chat/general/`
- `POST /api/chat/query/`

The chat `POST` endpoints now return a `conversation_id` so the frontend can continue an existing saved session.

## Data import

After the containers are up and migrations have run, import the SQLite data into Postgres with:

```bash
docker compose exec web python manage.py import_social_data --truncate
```

The import command reads `social-data.sqlite3`, recreates the `socialcomm_*` data in Postgres, and imports `auth_user` so the membership and awards relationships remain intact.

## Running locally

```bash
docker compose up --build
```

Frontend: `http://localhost:5173`

Backend API: `http://localhost:8000`

Local LLM API: `http://localhost:8001/v1`

If you already have the stack running and pull new backend changes, run migrations explicitly:

```bash
docker compose exec web python manage.py migrate
```

The `web` service also runs `python manage.py migrate` automatically on startup.
The backend is served through `uvicorn` so long-lived streaming responses such as the live dashboard SSE endpoint do not block normal API requests.

## Frontend behavior

- The landing page exposes `General`, `Query Agent`, and a history dashboard.
- Chat and dashboard navigation use hash-based links so normal browser open-in-new-tab behavior works.
- Opening a mode from the landing page resumes the latest saved conversation for that mode when one exists.
- The history dashboard lists saved turns in a compact table, with one row per question/answer pair.
- Rows stay uniform and collapsed by default, and can be expanded inline to inspect full question and answer text.
- A subtle colored gutter marker shows which rows belong to the same saved session without using a dedicated session column.
- The dashboard also provides links for starting a fresh `General` or `Query Agent` session without resuming history.

## Frontend tests

Run the frontend component tests from `frontend/`:

```bash
npm test
```

Run the browser automation suite:

```bash
npm run test:e2e
```

The Playwright suite starts a local Vite server and a Django server in deterministic UI test mode, so it does not require the LLM container.

To run a browser test against the real app and model instead of deterministic e2e mode, start the Docker stack first and then point Playwright at the existing frontend:

```bash
docker compose up --build
cd frontend
PLAYWRIGHT_USE_EXISTING_APP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/chat-flow.spec.js -g "history dashboard updates live when a new chat turn is saved from another tab" --headed
```

If the local model is slow on your machine, increase the chat response wait:

```bash
PLAYWRIGHT_USE_EXISTING_APP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHAT_RESPONSE_TIMEOUT_MS=300000 npx playwright test tests/e2e/chat-flow.spec.js -g "history dashboard updates live when a new chat turn is saved from another tab" --headed
```

## Notes

- The Query Agent is intentionally read-only. Django validates generated SQL before execution.
- Query execution-time SQL failures are returned as handled API errors instead of uncaught 500s, so malformed generated SQL surfaces cleanly in the UI.
- `Celery`, `Beat`, and `Redis` are intentionally deferred until there is a concrete async need.
- The default runtime is `llama.cpp` because it works on CPU-only machines more reliably than the previous `vLLM` setup.
- The default model is a GGUF quantization, `bartowski/Qwen_Qwen3.5-4B-GGUF:Q4_K_M`, loaded by the `llm` container at startup. You can change it through `.env`.
- First model startup can take time because `llama.cpp` downloads the GGUF artifact into the `llama_cache` Docker volume.
- On CPU-only hardware, the app uses smaller token budgets and disables Qwen thinking mode to reduce end-to-end latency.
