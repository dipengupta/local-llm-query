# Local LLM Query v1 Implementation Plan

## Summary

- Use `Docker + Django + DRF + Postgres + React SPA + llama.cpp`.
- Keep one local model service and expose two server-side modes:
  - `General` for normal chat
  - `Query Agent` for database-grounded answers only
- Treat `social-data.sqlite3` as the seed source and import it into Postgres through a Django management command.
- Defer `Celery`, `Beat`, and `Redis` until there is a real async requirement.

## Architecture

- `frontend/` hosts a React SPA with a landing page that presents `General` and `Query Agent` as two distinct entry points.
- `backend/` hosts Django and DRF as the sole API boundary for the browser.
- `llm` runs `llama.cpp` and serves a quantized GGUF Qwen model through an OpenAI-compatible API.
- `db` runs Postgres and stores both Django app state and the imported social data.

## Django app split

- `apps/core`: health checks and shared project-level utilities
- `apps/chat`: general chat endpoint, query chat endpoint, and local LLM client integration
- `apps/query_agent`: SQL generation prompt, read-only SQL validation, and query execution
- `apps/socialcomm`: imported data models and SQLite-to-Postgres import command

## Query Agent rules

- The browser never talks to the LLM runtime or Postgres directly.
- The model may suggest SQL, but Django must validate it before execution.
- Only allowlisted tables are queryable.
- Only read-only `SELECT` queries are allowed.
- The API should return the answer, the SQL used, and the resulting rows so the UI stays inspectable.

## Initial tests

- SQL validation accepts safe `SELECT` queries on allowlisted tables.
- SQL validation rejects writes, DDL, multi-statement SQL, and disallowed table access.
- API endpoints return the expected response shape.
- SQLite import preserves row counts and foreign-key relationships for the imported domain tables.
