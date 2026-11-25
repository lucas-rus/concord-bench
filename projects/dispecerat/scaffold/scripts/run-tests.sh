#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find_tsc() {
  if [ -n "${DISPECERAT_TSC:-}" ] && [ -x "${DISPECERAT_TSC}" ]; then
    echo "${DISPECERAT_TSC}"
    return 0
  fi
  local dir="$ROOT"
  while [ "$dir" != "/" ]; do
    if [ -x "$dir/node_modules/.bin/tsc" ]; then
      echo "$dir/node_modules/.bin/tsc"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  if command -v tsc >/dev/null 2>&1; then
    command -v tsc
    return 0
  fi
  echo "tsc not found (run 'npm install' or set DISPECERAT_TSC)" >&2
  return 1
}

TSC="$(find_tsc)"
TMP_BUILD="$(mktemp -d "${TMPDIR:-/tmp}/dispecerat-tsbuild.XXXXXX")"
trap 'rm -rf "$TMP_BUILD"' EXIT

"$TSC" -p tsconfig.json --outDir "$TMP_BUILD"

shopt -s nullglob
TEST_FILES=("$TMP_BUILD"/tests/*.test.js)
if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo "No compiled tests found in $TMP_BUILD/tests" >&2
  exit 1
fi

DISPECERAT_BUILD_DIR="$TMP_BUILD" node --import ./scripts/ts-alias.mjs --test "${TEST_FILES[@]}"
