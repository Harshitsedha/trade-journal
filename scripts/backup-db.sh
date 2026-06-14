#!/usr/bin/env bash
set -euo pipefail

# Dumps the database referenced by $DIRECT_URL to backups/ as a custom-format
# (-F c) dump. This script ONLY ever runs pg_dump — a read-only operation that
# mutates nothing. See CLAUDE.md: run before any DB-touching work.
#
# Prod: a prod dump is the safe pre-migration step, but is gated behind an
# explicit opt-in so it can never happen by accident:
#     ALLOW_PROD_BACKUP=1 DIRECT_URL=<prod> bash scripts/backup-db.sh
# Without ALLOW_PROD_BACKUP=1, a prod target aborts.
#
# Fails loudly: a non-zero pg_dump exit, an empty file, or a dump that does not
# pass an integrity check all abort with a clear error and exit 1. Success is
# only ever printed after the dump is verified readable.

PROD_ENDPOINT='ep-noisy-brook-aotot7c1' # production Neon endpoint (mirrors tests/setup.ts)

TARGET="${DIRECT_URL:-}"

# Refuse to run against an empty/unset target (pg_dump "" has surprising behavior).
if [ -z "$TARGET" ]; then
  echo "ERROR: DIRECT_URL is not set — refusing to run pg_dump against an empty target." >&2
  exit 1
fi

# Prod-endpoint guard: a prod dump requires the explicit ALLOW_PROD_BACKUP=1
# opt-in. pg_dump is read-only (no schema change, no write), so this only gates
# *which database* gets dumped — it cannot mutate prod. Writes to prod (migrate,
# seed, deleteMany) are not in this script and are guarded elsewhere.
case "$TARGET" in
  *"$PROD_ENDPOINT"*)
    if [ "${ALLOW_PROD_BACKUP:-}" != "1" ]; then
      echo "ERROR: DIRECT_URL points at the PRODUCTION endpoint ($PROD_ENDPOINT)." >&2
      echo "       Prod backup requires ALLOW_PROD_BACKUP=1. Aborting." >&2
      exit 1
    fi
    echo "NOTE: ALLOW_PROD_BACKUP=1 set — taking a read-only dump of PRODUCTION ($PROD_ENDPOINT)."
    ;;
esac

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
OUT="backups/backup_$TIMESTAMP.dump"

# Run pg_dump and capture its real exit code (do not let `set -e` swallow it).
pg_dump "$TARGET" -F c -f "$OUT" && rc=0 || rc=$?
if [ "${rc:-1}" -ne 0 ]; then
  echo "ERROR: pg_dump failed (exit $rc). No usable backup produced." >&2
  rm -f "$OUT"
  exit 1
fi

# The file must exist and be non-empty.
if [ ! -s "$OUT" ]; then
  echo "ERROR: backup file '$OUT' is missing or empty. Failing." >&2
  rm -f "$OUT"
  exit 1
fi

# Integrity check: a valid custom-format dump must be listable by pg_restore.
if ! pg_restore --list "$OUT" >/dev/null 2>&1; then
  echo "ERROR: integrity check failed — pg_restore could not read '$OUT'. Failing." >&2
  rm -f "$OUT"
  exit 1
fi

SIZE=$(wc -c < "$OUT" | tr -d '[:space:]')
echo "Backup OK: $OUT ($SIZE bytes)"
