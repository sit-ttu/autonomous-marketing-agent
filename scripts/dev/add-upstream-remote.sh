#!/usr/bin/env bash
# Add OpenClaw upstream remote for selective sync (see docs/upstream-openclaw-sync-todo.md).
set -euo pipefail
REMOTE_NAME="${REMOTE_NAME:-upstream}"
REMOTE_URL="${REMOTE_URL:-https://github.com/openclaw/openclaw.git}"
if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "Remote '$REMOTE_NAME' already exists: $(git remote get-url "$REMOTE_NAME")"
else
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
  echo "Added remote '$REMOTE_NAME' -> $REMOTE_URL"
fi
echo "Fetch with: git fetch $REMOTE_NAME main"
echo "Compare: git log --oneline HEAD..$REMOTE_NAME/main | head"
