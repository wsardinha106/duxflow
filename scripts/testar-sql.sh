#!/usr/bin/env bash
# Testa as migrations num Postgres local descartável (opcional; precisa de psql).
# Uso: PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/testar-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BANCO=painel_teste_$$
PSQL=(psql -X -v ON_ERROR_STOP=1 -q -d "$BANCO")
psql -X -q -d postgres -c "CREATE DATABASE $BANCO"
trap 'psql -X -q -d postgres -c "DROP DATABASE IF EXISTS $BANCO WITH (FORCE)"' EXIT
"${PSQL[@]}" -f supabase/testes/stubs.sql
for f in supabase/migrations/*.sql; do
  # pg_net e pg_cron só existem no Supabase: os stubs fazem o papel deles.
  sed -E 's/^CREATE EXTENSION IF NOT EXISTS (pg_net|pg_cron).*$/-- (stub) &/' "$f" | "${PSQL[@]}" -f - > /dev/null
done
# reaplicar tem que funcionar (idempotência)
for f in supabase/migrations/*.sql; do
  sed -E 's/^CREATE EXTENSION IF NOT EXISTS (pg_net|pg_cron).*$/-- (stub) &/' "$f" | "${PSQL[@]}" -f - > /dev/null
done
"${PSQL[@]}" -f supabase/testes/funcoes.sql
bash supabase/testes/concorrencia.sh "${PSQL[@]}"
