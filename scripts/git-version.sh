#!/bin/sh
set -eu

first_defined() {
  for value in "$@"; do
    if [ -n "$value" ]; then
      printf '%s\n' "$value"
      return 0
    fi
  done

  return 1
}

normalize() {
  printf '%s' "$1" | tr '/: ' '---' | tr -cd '[:alnum:]._-'
}

branch=$(
  first_defined \
    "${KRYO_VERSION:-}" \
    "${GITHUB_HEAD_REF:-}" \
    "${GITHUB_REF_NAME:-}" \
    "${CI_COMMIT_REF_NAME:-}" \
    "${BRANCH_NAME:-}" ||
    true
)

if [ -z "$branch" ]; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')
fi

if [ "$branch" = "HEAD" ] || [ -z "$branch" ]; then
  branch=unknown
fi

normalize "$branch"
