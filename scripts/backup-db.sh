#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
pg_dump "$DIRECT_URL" -F c -f "backups/backup_$TIMESTAMP.dump"
echo "Backup saved: backups/backup_$TIMESTAMP.dump"
