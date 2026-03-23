#!/bin/sh
# Reset demo state so the agent can run the full loop cleanly.
# - Closes all open PRs on the demo repo
# - Moves card #1 back to To Do, unassigned
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

. "$(dirname "$0")/bootstrap-env-common.sh"

ensure_env_file

FIZZY_API_TOKEN=$(require_env_setting "FIZZY_API_TOKEN")
FIZZY_ACCOUNT_ID=$(require_env_setting "FIZZY_ACCOUNT_ID")
FIZZY_BOARD_ID=$(require_env_setting "FIZZY_BOARD_ID")
GIT_FORGE_TOKEN=$(require_env_setting "GIT_FORGE_TOKEN")
GIT_FORGE_REPO=$(require_env_setting "GIT_FORGE_REPO")
WORKFLOW_TODO_COLUMN=${WORKFLOW_TODO_COLUMN:-To Do}

# The MCP container reaches services via internal hostnames (kryo-fizzy, kryo-gitea).
# demo-reset.sh runs on the host and needs the port-mapped localhost addresses.
# Set DEMO_FIZZY_URL / DEMO_GIT_FORGE_API_URL to override; defaults use standard ports.
FIZZY_URL=${DEMO_FIZZY_URL:-http://localhost:3006}
GIT_FORGE_API_URL=${DEMO_GIT_FORGE_API_URL:-http://localhost:3007/api/v1}

# ── helpers ──────────────────────────────────────────────────────────────────

fizzy() {
  method="$1"; path="$2"; shift 2
  curl -fsS -X "$method" \
    -H "Authorization: Bearer $FIZZY_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$FIZZY_URL/$FIZZY_ACCOUNT_ID/$path" \
    "$@"
}

gitea() {
  method="$1"; path="$2"; shift 2
  curl -fsS -X "$method" \
    -H "Authorization: token $GIT_FORGE_TOKEN" \
    -H "Content-Type: application/json" \
    "$GIT_FORGE_API_URL/$path" \
    "$@"
}

# ── close open PRs ────────────────────────────────────────────────────────────

printf 'Closing open PRs on %s...\n' "$GIT_FORGE_REPO"
open_prs=$(gitea GET "repos/$GIT_FORGE_REPO/pulls?state=open&limit=50" | \
  python3 -c "import sys,json; [print(p['number']) for p in json.load(sys.stdin)]" 2>/dev/null || true)

for pr in $open_prs; do
  printf '  closing PR #%s\n' "$pr"
  gitea PATCH "repos/$GIT_FORGE_REPO/pulls/$pr" -d '{"state":"closed"}' > /dev/null
done

# ── find To Do column ─────────────────────────────────────────────────────────

printf 'Finding "%s" column on board %s...\n' "$WORKFLOW_TODO_COLUMN" "$FIZZY_BOARD_ID"
todo_col_id=$(fizzy GET "boards/$FIZZY_BOARD_ID/columns.json" | \
  python3 -c "
import sys, json
cols = json.load(sys.stdin)
target = '$WORKFLOW_TODO_COLUMN'.lower()
match = next((c for c in cols if c['name'].lower() == target), None)
print(match['id'] if match else '')
" 2>/dev/null || true)

if [ -z "$todo_col_id" ]; then
  printf 'Warning: could not find "%s" column — skipping card move.\n' "$WORKFLOW_TODO_COLUMN" >&2
fi

# ── reset card #1 ─────────────────────────────────────────────────────────────

printf 'Resetting card #1...\n'

# Unassign all current assignees
assignees=$(fizzy GET "cards/1.json" | \
  python3 -c "import sys,json; [print(a['id']) for a in json.load(sys.stdin).get('assignees',[])]" 2>/dev/null || true)

for uid in $assignees; do
  printf '  unassigning %s\n' "$uid"
  fizzy POST "cards/1/assignments.json" -d "{\"assignee_id\":\"$uid\"}" > /dev/null
done

# Reopen if closed
closed=$(fizzy GET "cards/1.json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('closed',False))" 2>/dev/null || echo False)
if [ "$closed" = "True" ]; then
  printf '  reopening card\n'
  fizzy DELETE "cards/1/closure.json" > /dev/null
fi

# Move to To Do
if [ -n "$todo_col_id" ]; then
  printf '  moving to "%s"\n' "$WORKFLOW_TODO_COLUMN"
  fizzy POST "cards/1/triage.json" -d "{\"column_id\":\"$todo_col_id\"}" > /dev/null
fi

printf 'Demo reset complete.\n'
