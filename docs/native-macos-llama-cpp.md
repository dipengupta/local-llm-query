# Native macOS `llama.cpp`

This branch uses native macOS `llama.cpp` as the recommended runtime on Apple Silicon.

## Why

- Apple Silicon can use Metal directly when `llama.cpp` runs on the host.
- The backend already expects an OpenAI-compatible chat server, so the app contract stays the same.
- Docker remains useful for Postgres, Django, and Vite without forcing the model path through a Linux container.

## One-command workflow

Run:

```bash
./scripts/up_native_apple_silicon.sh
```

What it does:

- installs `llama.cpp` with Homebrew if `llama-server` is missing
- starts a native Apple Silicon `llama-server`
- waits for the model endpoint to become ready
- starts the Dockerized Postgres, Django, and frontend services with `LLM_BASE_URL` pointed at `host.docker.internal`

The helper binds `llama-server` to `0.0.0.0` so the Dockerized backend can reach it.

## Defaults

- Model repo: `bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M`
- Alias: `local-qwen25-coder-7b`
- Port: `18001`
- Context: `4096`
- Threads: `8`

## Useful overrides

The native helper scripts respect these shell environment variables:

- `LLAMA_CPP_HF_MODEL`
- `LLAMA_CPP_ALIAS`
- `LLAMA_CPP_HOST`
- `LLAMA_CPP_PORT`
- `LLAMA_CPP_CTX_SIZE`
- `LLAMA_CPP_THREADS`
- `NATIVE_LLAMA_CPP_HF_MODEL`
- `NATIVE_LLAMA_CPP_ALIAS`
- `LLAMA_CPP_LOG_FILE`

The app runtime respects:

- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_TIMEOUT_SECONDS`

If you run Django outside Docker, point `LLM_BASE_URL` at `http://localhost:18001/v1` instead of `host.docker.internal`.

Host port defaults in this branch:

- Postgres: `15432`
- Backend: `18000`
- Frontend: `15173`
- Native `llama.cpp`: `18001`

You can override them in `.env` with `HOST_POSTGRES_PORT`, `HOST_BACKEND_PORT`, `HOST_FRONTEND_PORT`, and `LLAMA_CPP_PORT`.

## Optional container path

If you want the older all-Docker path:

```bash
LLM_BASE_URL=http://llm:8000/v1 \
LLM_MODEL=local-qwen25-coder-7b \
docker compose --profile container-llm up --build
```

That path starts the Docker `llm` service instead of the host-native one. It is simpler, but it does not use Apple Silicon as effectively.
