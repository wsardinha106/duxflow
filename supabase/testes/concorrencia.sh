#!/usr/bin/env bash
# Duas rodadas simultâneas nunca pegam o mesmo item (FOR UPDATE SKIP LOCKED).
set -euo pipefail
PSQL=("$@")
"${PSQL[@]}" -q -c "TRUNCATE conteudos_instagram; INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls, status)
  SELECT 'reel', now() - (g || ' minutes')::interval, '{https://x/v.mp4}', 'agendado' FROM generate_series(1, 8) g;"
# Sessão A reserva e segura a transação aberta por 2 s; B roda no meio.
( "${PSQL[@]}" -tA -c "BEGIN; SELECT id FROM reservar_conteudos_para_publicar(5); SELECT pg_sleep(2); COMMIT;" | grep -E '^[0-9a-f-]{36}$' > /tmp/rodada_a.txt ) &
sleep 0.7
"${PSQL[@]}" -tA -c "SELECT id FROM reservar_conteudos_para_publicar(5);" | grep -E '^[0-9a-f-]{36}$' > /tmp/rodada_b.txt
wait
A=$(wc -l < /tmp/rodada_a.txt); B=$(wc -l < /tmp/rodada_b.txt)
REPETIDOS=$(sort /tmp/rodada_a.txt /tmp/rodada_b.txt | uniq -d | wc -l)
echo "rodada A pegou $A, rodada B pegou $B, repetidos: $REPETIDOS"
[ "$A" -eq 5 ] && [ "$B" -eq 3 ] && [ "$REPETIDOS" -eq 0 ] || { echo "FALHOU: concorrência"; exit 1; }
echo "ok: SKIP LOCKED"
