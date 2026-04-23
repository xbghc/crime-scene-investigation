#!/usr/bin/env bash
# render_d2.sh <slug>
# Renders all .d2 files under .claude/blog/diagrams/<slug>/ to .svg

set -euo pipefail

SLUG="${1:?usage: render_d2.sh <slug>}"
DIAG_DIR=".claude/blog/diagrams/$SLUG"

if [ ! -d "$DIAG_DIR" ]; then
  echo "no diagrams directory: $DIAG_DIR"
  exit 0
fi

for d2file in "$DIAG_DIR"/*.d2; do
  [ -f "$d2file" ] || continue
  svg="${d2file%.d2}.svg"
  d2 --layout=elk "$d2file" "$svg"
  echo "rendered: $svg"
done
