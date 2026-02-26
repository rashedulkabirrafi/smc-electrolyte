#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT_DIR/frontend/public/data"
URL="https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_BGD_2.json.zip"

mkdir -p "$DEST_DIR"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ZIP_PATH="$TMP_DIR/gadm41_BGD_2.json.zip"
JSON_PATH="$TMP_DIR/gadm41_BGD_2.json"
DEST_PATH="$DEST_DIR/bd_districts.geojson"

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not installed."
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Error: unzip is required but not installed."
  exit 1
fi

echo "Downloading GADM Bangladesh Level 2 districts..."
curl -fsSL "$URL" -o "$ZIP_PATH"

echo "Unzipping dataset..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

if [[ ! -f "$JSON_PATH" ]]; then
  echo "Error: Expected file not found after unzip: $JSON_PATH"
  exit 1
fi

mv "$JSON_PATH" "$DEST_PATH"

echo "Success: saved district boundaries to $DEST_PATH"
