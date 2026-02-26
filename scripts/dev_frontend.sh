#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
PORT="${1:-3000}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed."
  exit 1
fi

next_free_port() {
  local p="$1"

  while true; do
    if command -v lsof >/dev/null 2>&1; then
      if ! lsof -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "$p"
        return 0
      fi
    elif command -v ss >/dev/null 2>&1; then
      if ! ss -ltn "sport = :$p" 2>/dev/null | grep -q ":$p"; then
        echo "$p"
        return 0
      fi
    else
      echo "$p"
      return 0
    fi

    p=$((p + 1))
  done
}

FREE_PORT="$(next_free_port "$PORT")"

echo "Starting frontend on http://localhost:$FREE_PORT"
cd "$FRONTEND_DIR"
npm run dev -- -p "$FREE_PORT"
