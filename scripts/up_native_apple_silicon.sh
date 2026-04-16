#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

MODEL_PORT="${LLAMA_CPP_PORT:-18001}"
MODEL_ALIAS="${NATIVE_LLAMA_CPP_ALIAS:-local-qwen25-coder-7b}"
MODEL_REPO="${NATIVE_LLAMA_CPP_HF_MODEL:-bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M}"
MODEL_LOG_FILE="${LLAMA_CPP_LOG_FILE:-/tmp/local-llm-query-llama.log}"
MODEL_URL="http://127.0.0.1:${MODEL_PORT}/v1/models"
DOCKER_LLM_BASE_URL="http://host.docker.internal:${MODEL_PORT}/v1"

STARTED_SERVER=0
SERVER_PID=""

cleanup() {
    if [ "$STARTED_SERVER" = "1" ] && [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

ensure_llama_server() {
    if command -v llama-server >/dev/null 2>&1; then
        return
    fi

    if ! command -v brew >/dev/null 2>&1; then
        echo "llama-server was not found and Homebrew is unavailable. Install llama.cpp manually first." >&2
        exit 1
    fi

    echo "Installing llama.cpp with Homebrew because llama-server was not found..."
    brew install llama.cpp
}

server_has_expected_alias() {
    response=$(curl -fsS "$MODEL_URL" 2>/dev/null) || return 1
    printf '%s' "$response" | grep -q "\"$MODEL_ALIAS\""
}

wait_for_server() {
    attempts=0
    while [ "$attempts" -lt 180 ]; do
        if server_has_expected_alias; then
            return 0
        fi

        if [ "$STARTED_SERVER" = "1" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo "The native llama.cpp server exited before becoming ready. See $MODEL_LOG_FILE for details." >&2
            exit 1
        fi

        attempts=$((attempts + 1))
        sleep 2
    done

    echo "Timed out waiting for the native llama.cpp server at $MODEL_URL. See $MODEL_LOG_FILE for details." >&2
    exit 1
}

ensure_llama_server

if server_has_expected_alias; then
    echo "Reusing an existing native llama.cpp server on port $MODEL_PORT."
elif curl -fsS "$MODEL_URL" >/dev/null 2>&1; then
    echo "Port $MODEL_PORT already has a responding service, but it does not expose the expected model alias $MODEL_ALIAS." >&2
    echo "Stop that service or change NATIVE_LLAMA_CPP_ALIAS / LLAMA_CPP_PORT before retrying." >&2
    exit 1
else
    echo "Starting native llama.cpp on port $MODEL_PORT with $MODEL_REPO ..."
    LLAMA_CPP_HF_MODEL="$MODEL_REPO" \
    LLAMA_CPP_ALIAS="$MODEL_ALIAS" \
    LLAMA_CPP_PORT="$MODEL_PORT" \
    "$SCRIPT_DIR/start_native_llama_cpp.sh" >"$MODEL_LOG_FILE" 2>&1 &
    SERVER_PID=$!
    STARTED_SERVER=1
    echo "llama.cpp logs: $MODEL_LOG_FILE"
    wait_for_server
fi

echo "Starting Docker services with LLM_BASE_URL=$DOCKER_LLM_BASE_URL ..."
cd "$REPO_ROOT"
LLM_BASE_URL="$DOCKER_LLM_BASE_URL" \
LLM_MODEL="$MODEL_ALIAS" \
docker compose up --build "$@"
