# agents.md

This repository is designed for a local LLM web app with two backend-controlled modes: `General` and `Query Agent`. Any contributor or coding agent working here should preserve that separation and keep database access safety anchored in Django.

## Working rules

- Keep the browser talking only to Django. Do not add direct browser access to Postgres or the LLM runtime.
- Treat `Query Agent` as database-grounded and read-only. Any generated SQL must be validated server-side before execution.
- Prefer small, reviewable changes over broad rewrites.
- Preserve existing behavior unless the task explicitly changes it.
- Do not add background infrastructure such as `Celery`, `Beat`, or `Redis` without a concrete requirement.
- Do not introduce destructive migration or data-reset behavior implicitly. Make those actions explicit.

## Architecture expectations

- `backend/` owns orchestration, validation, and database access.
- `frontend/` owns the user interface and mode selection.
- `apps/socialcomm` owns the imported domain schema.
- `apps/query_agent` owns SQL safety, query execution, and database-grounded answer flow.
- `apps/chat` owns model-facing chat interfaces and shared LLM client logic.

## Query Agent safety practices

- Restrict access to allowlisted tables only.
- Reject writes, DDL, multi-statement SQL, comments used to smuggle extra SQL, and system catalog access.
- Keep row limits bounded for list-style queries.
- Prefer explicit response payloads that show the executed SQL and returned rows.
- If the question is outside the schema, refuse instead of fabricating.

## Change checklist

- If you change an API contract, update both the backend serializer/view and the frontend caller.
- If you change the schema available to `Query Agent`, update both the allowlist and the prompt context.
- If you change data import behavior, preserve relational integrity and update tests.
- If you change Docker or startup flows, keep the local developer path straightforward.
- Add or update tests for behavior changes, especially around SQL validation and import logic.
