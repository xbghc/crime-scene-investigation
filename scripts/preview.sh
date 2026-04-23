#!/usr/bin/env bash
# preview.sh <slug>
# Render D2 diagrams and expose the blog post via cloudflared quick tunnel
# with a token-protected local server.
#
# Claude decides whether to call this script. If the project has its own doc
# server, Claude puts the post there instead and doesn't invoke this.

set -euo pipefail

SLUG="${1:?usage: preview.sh <slug>}"
BLOG_DIR=".claude/blog"
POST="$BLOG_DIR/${SLUG}.md"

if [ ! -f "$POST" ]; then
  POST=$(ls "$BLOG_DIR"/*"$SLUG".md 2>/dev/null | head -1 || true)
  if [ -z "$POST" ]; then
    echo "post not found for slug: $SLUG"
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- 1. Render diagrams ---
bash "$SCRIPT_DIR/render_d2.sh" "$SLUG" || true

# --- 2. Check dependencies ---
command -v cloudflared >/dev/null || {
  echo "cloudflared not found. install: brew install cloudflared / apt install cloudflared"
  exit 1
}
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
python3 -c "import markdown" 2>/dev/null || {
  echo "python 'markdown' package missing. install: pip install --break-system-packages markdown"
  exit 1
}

# --- 3. Generate token and pick port ---
TOKEN=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')

# --- 4. Start md server in background ---
python3 "$SCRIPT_DIR/md_server.py" "$PORT" "$BLOG_DIR" "$TOKEN" &
SERVER_PID=$!

cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Give server a moment to bind
sleep 0.3

SLUG_PATH="${POST#$BLOG_DIR/}"
echo "local: http://localhost:${PORT}/${SLUG_PATH}?t=${TOKEN}"
echo "starting cloudflared tunnel..."
echo "---"

# --- 5. Run cloudflared, capture and rewrite its URL line ---
# cloudflared prints the tunnel URL. We tee it, detect the URL,
# and print the token-appended version.
cloudflared tunnel --url "http://localhost:${PORT}" 2>&1 | awk -v tok="$TOKEN" -v path="$SLUG_PATH" '
  {
    print
    if (match($0, /https:\/\/[a-z0-9-]+\.trycloudflare\.com/)) {
      url = substr($0, RSTART, RLENGTH)
      if (!printed) {
        print ""
        print "=== preview URL (with token) ==="
        print url "/" path "?t=" tok
        print "================================"
        printed = 1
      }
    }
  }
'
