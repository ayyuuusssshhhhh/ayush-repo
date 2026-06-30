#!/usr/bin/env bash
# Session-start hook: build browser-agent MCP server and install Chromium.
# Runs automatically every time a Claude Code web session starts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PW_DIR="/tmp/pw"

echo "[session-start] Installing browser-agent dependencies..."
cd "$REPO_ROOT/browser-agent"
npm install --prefer-offline --loglevel=warn

echo "[session-start] Building TypeScript..."
npm run build

echo "[session-start] Installing Playwright Chromium to $PW_DIR..."
PLAYWRIGHT_BROWSERS_PATH="$PW_DIR" npx playwright install chromium 2>&1 | tail -5

echo "[session-start] Done. browser-agent MCP server is ready."
