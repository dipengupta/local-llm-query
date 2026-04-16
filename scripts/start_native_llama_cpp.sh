#!/bin/sh

set -eu

if ! command -v llama-server >/dev/null 2>&1; then
    echo "llama-server was not found. Install llama.cpp first, for example with: brew install llama.cpp" >&2
    exit 1
fi

MODEL_REPO="${LLAMA_CPP_HF_MODEL:-bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M}"
MODEL_ALIAS="${LLAMA_CPP_ALIAS:-local-qwen25-coder-7b}"
# Bind to all interfaces so the Dockerized Django container can reach the host-native server.
MODEL_HOST="${LLAMA_CPP_HOST:-0.0.0.0}"
MODEL_PORT="${LLAMA_CPP_PORT:-18001}"
MODEL_CTX_SIZE="${LLAMA_CPP_CTX_SIZE:-4096}"
MODEL_THREADS="${LLAMA_CPP_THREADS:-8}"

exec llama-server \
    -hf "$MODEL_REPO" \
    --alias "$MODEL_ALIAS" \
    --host "$MODEL_HOST" \
    --port "$MODEL_PORT" \
    --ctx-size "$MODEL_CTX_SIZE" \
    --jinja \
    --no-webui \
    --threads "$MODEL_THREADS"
