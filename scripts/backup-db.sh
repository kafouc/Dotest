#!/usr/bin/env bash
# Sauvegarde chiffrée de la base Supabase (schémas public et auth).
#
#   SUPABASE_DB_URL='postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres' \
#   BACKUP_PASSPHRASE='phrase-secrete-longue' \
#   ./scripts/backup-db.sh [dossier-de-sortie]
#
# Le fichier produit (backup-AAAAMMJJ-HHMMSS.sql.gz.gpg) contient des données personnelles :
# il est chiffré (AES-256) et ne doit JAMAIS être déposé dans le dépôt ni dans un artefact GitHub public.
# Les fichiers du Storage (bucket pdfs) ne sont pas inclus : voir docs/OPERATIONS.md.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquante}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquante}"

OUT_DIR="${1:-.}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="${OUT_DIR}/backup-${STAMP}.sql.gz.gpg"
mkdir -p "$OUT_DIR"

# pg_dump local si disponible, sinon via Docker (même version majeure que Supabase : 17)
if command -v pg_dump >/dev/null 2>&1 && [ "$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')" -ge 17 ]; then
  DUMP=(pg_dump)
else
  DUMP=(docker run --rm -i postgres:17 pg_dump)
fi

"${DUMP[@]}" "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  --schema=public --schema=auth \
  | gzip -9 \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$FILE"

echo "Sauvegarde écrite : $FILE ($(du -h "$FILE" | cut -f1))"
