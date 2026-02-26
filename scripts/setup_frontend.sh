#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed."
  exit 1
fi

echo "Node version: $(node -v)"
echo "npm version:  $(npm -v)"

echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

cd "$ROOT_DIR"
echo "Syncing district boundary data..."
bash "$ROOT_DIR/scripts/fetch_gadm_districts.sh"

if [[ ! -f "$FRONTEND_DIR/public/data/heatstroke_incidents.csv" ]]; then
  echo "Error: Missing incidents CSV at $FRONTEND_DIR/public/data/heatstroke_incidents.csv"
  exit 1
fi

echo "Setup complete."
echo "Next: bash scripts/dev_frontend.sh"
