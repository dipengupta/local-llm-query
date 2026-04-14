# local-llm-query

`local-llm-query` is a starter project for learning how to run a local LLM in a web app with two modes:

- `General`: normal chat with the local model
- `Query Agent`: database-grounded answers against a Postgres copy of `social-data.sqlite3`

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
- `agents.md`: contributor guidance for humans and coding agents

## Key API endpoints

- `GET /api/core/health/`
- `POST /api/chat/general/`
- `POST /api/chat/query/`

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

## Notes

- The Query Agent is intentionally read-only. Django validates generated SQL before execution.
- `Celery`, `Beat`, and `Redis` are intentionally deferred until there is a concrete async need.
- The default runtime is `llama.cpp` because it works on CPU-only machines more reliably than the previous `vLLM` setup.
- The default model is a GGUF quantization, `bartowski/Qwen_Qwen3.5-4B-GGUF:Q4_K_M`, loaded by the `llm` container at startup. You can change it through `.env`.
- First model startup can take time because `llama.cpp` downloads the GGUF artifact into the `llama_cache` Docker volume.
- On CPU-only hardware, the app uses smaller token budgets and disables Qwen thinking mode to reduce end-to-end latency.
