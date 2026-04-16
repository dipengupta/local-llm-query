# local-llm-query

`local-llm-query` is a starter project for learning how to run a local LLM in a web app with two modes:

- `General`: normal chat with the local model
- `Query Agent`: database-grounded answers against a Postgres copy of `social-data.sqlite3`

The current app also persists conversation history for both modes and exposes a dashboard in the frontend so saved chats can be reviewed and reopened.

## Stack

- Django + Django REST Framework
- React + Vite
- Postgres
- `llama.cpp` serving a quantized GGUF model through an OpenAI-compatible API
- Native `llama.cpp` on macOS plus Docker Compose for the rest of the app stack

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
./scripts/up_native_apple_silicon.sh
```

Frontend: `http://localhost:15173`

Backend API: `http://localhost:18000`

Local LLM API: `http://localhost:18001/v1`

Postgres: `localhost:15432`

On first run, the script installs `llama.cpp` with Homebrew if needed, starts a native Apple Silicon `llama-server`, and downloads `bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M`. Expect a one-time delay while the model downloads.

If those host ports still collide with something on your machine, change `HOST_POSTGRES_PORT`, `HOST_BACKEND_PORT`, `HOST_FRONTEND_PORT`, or `LLAMA_CPP_PORT` in `.env`.

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

The Playwright suite starts a local Vite server and a Django server in deterministic UI test mode, so it does not require the LLM runtime.

To run a browser test against the real app and model instead of deterministic e2e mode, start the Docker stack first and then point Playwright at the existing frontend:

```bash
./scripts/up_native_apple_silicon.sh
cd frontend
PLAYWRIGHT_USE_EXISTING_APP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:15173 npx playwright test tests/e2e/chat-flow.spec.js -g "history dashboard updates live when a new chat turn is saved from another tab" --headed
```

If the local model is slow on your machine, increase the chat response wait:

```bash
PLAYWRIGHT_USE_EXISTING_APP=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:15173 PLAYWRIGHT_CHAT_RESPONSE_TIMEOUT_MS=300000 npx playwright test tests/e2e/chat-flow.spec.js -g "history dashboard updates live when a new chat turn is saved from another tab" --headed
```

## Notes

- The Query Agent is intentionally read-only. Django validates generated SQL before execution.
- Query execution-time SQL failures are returned as handled API errors instead of uncaught 500s, so malformed generated SQL surfaces cleanly in the UI.
- `Celery`, `Beat`, and `Redis` are intentionally deferred until there is a concrete async need.
- The recommended runtime in this branch is `./scripts/up_native_apple_silicon.sh`.
- That wrapper starts a host-native `llama.cpp` server, points Dockerized Django at it, and uses `bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M` under the alias `local-qwen25-coder-7b`.
- This path is the one that actually takes advantage of Apple Silicon best in this repo.
- On Apple Silicon, the app still disables Qwen thinking mode for faster end-to-end chat and Query Agent latency.

## Optional container runtime

If you want the older containerized LLM path for comparison, see [docs/native-macos-llama-cpp.md](docs/native-macos-llama-cpp.md).
