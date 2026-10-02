-- Testes de comportamento das migrations (rodar com scripts/testar-sql.sh).
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.esperar_erro(p_sql text, p_role text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  EXECUTE p_sql;
  RESET ROLE;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  RETURN true;
END $$;

-- 1. Segredos fechados ------------------------------------------------------
INSERT INTO configuracoes (chave, valor) VALUES ('ig_access_token', 'SEGREDO') ON CONFLICT (chave) DO UPDATE SET valor = 'SEGREDO';
DO $$ BEGIN
  ASSERT pg_temp.esperar_erro('SELECT * FROM configuracoes', 'anon'), 'anon leu configuracoes';
  ASSERT pg_temp.esperar_erro('SELECT * FROM configuracoes', 'authenticated'), 'authenticated leu configuracoes';
  ASSERT pg_temp.esperar_erro('SELECT * FROM conteudos_instagram', 'anon'), 'anon leu conteudos';
  ASSERT pg_temp.esperar_erro('SELECT proxima_data_livre(''reel'')', 'anon'), 'anon executou RPC';
  ASSERT pg_temp.esperar_erro('SELECT * FROM reservar_conteudos_para_publicar()', 'authenticated'), 'authenticated executou reserva';
  ASSERT pg_temp.esperar_erro('SELECT disparar_publicacao()', 'authenticated'), 'authenticated disparou cron';
  RAISE NOTICE 'ok: segredos e RPCs fechados';
END $$;
SET ROLE service_role;
DO $$ BEGIN ASSERT (SELECT valor FROM configuracoes WHERE chave = 'ig_access_token') = 'SEGREDO'; END $$;
RESET ROLE;
DO $$ BEGIN ASSERT length((SELECT valor FROM configuracoes WHERE chave = 'cron_secret')) = 64, 'cron_secret gerado'; END $$;

-- 2. proxima_data_livre ------------------------------------------------------
TRUNCATE conteudos_instagram;
DO $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_slot_hoje timestamptz := (v_hoje + time '06:00') AT TIME ZONE 'America/Sao_Paulo';
  v_esperado timestamptz;
  v timestamptz;
BEGIN
  v := proxima_data_livre('reel');
  v_esperado := CASE WHEN v_slot_hoje > now() THEN v_slot_hoje ELSE v_slot_hoje + interval '1 day' END;
  ASSERT v = v_esperado, format('fila vazia: %s <> %s', v, v_esperado);
  ASSERT to_char(v AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = '06:00';
  ASSERT to_char(proxima_data_livre('carrossel') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = '15:00';

  -- ocupa o primeiro dia livre e o seguinte; descartado não ocupa
  INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls) VALUES ('reel', v_esperado, '{https://x/v.mp4}');
  INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls, status) VALUES ('reel', v_esperado + interval '1 day', '{https://x/v.mp4}', 'descartado');
  ASSERT proxima_data_livre('reel') = v_esperado + interval '1 day', 'descartado não deveria ocupar a vaga';
  INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls, status) VALUES ('reel', v_esperado + interval '1 day 3 hours', '{https://x/v.mp4}', 'agendado');
  ASSERT proxima_data_livre('reel') = v_esperado + interval '2 days', 'um por dia de cada tipo';
  -- outro tipo não interfere
  ASSERT to_char(proxima_data_livre('carrossel') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = '15:00';
  RAISE NOTICE 'ok: proxima_data_livre';
END $$;
DO $$ BEGIN
  PERFORM proxima_data_livre('story');
  RAISE EXCEPTION 'tipo inválido deveria lançar erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'tipo inválido deveria%' THEN RAISE; END IF;
END $$;

-- 3. CHECKs de mídia por tipo -----------------------------------------------
DO $$ BEGIN
  BEGIN
    INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls) VALUES ('carrossel', now(), '{https://x/1.jpg}');
    RAISE EXCEPTION 'carrossel com 1 imagem passou';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls) VALUES ('reel', now(), '{https://x/1.mp4,https://x/2.mp4}');
    RAISE EXCEPTION 'reel com 2 vídeos passou';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'ok: checks de mídia';
END $$;

-- 4. puxar_fila ---------------------------------------------------------------
TRUNCATE conteudos_instagram;
DO $$
DECLARE
  base timestamptz := date_trunc('day', now()) + interval '10 days 9 hours';
  n int;
BEGIN
  INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls, status) VALUES
    ('reel', base,                     '{https://x/v.mp4}', 'descartado'),
    ('reel', base + interval '1 day',  '{https://x/v.mp4}', 'pendente'),
    ('reel', base + interval '2 days', '{https://x/v.mp4}', 'agendado'),
    ('reel', base + interval '3 days', '{https://x/v.mp4}', 'publicado'),
    ('reel', base + interval '4 days', '{https://x/v.mp4}', 'erro'),
    ('carrossel', base + interval '1 day', '{https://x/1.jpg,https://x/2.jpg}', 'pendente'),
    ('reel', base - interval '1 day',  '{https://x/v.mp4}', 'agendado');
  n := puxar_fila('reel', base);
  ASSERT n = 2, format('puxou %s, esperado 2', n);
  ASSERT (SELECT count(*) FROM conteudos_instagram WHERE tipo = 'reel' AND status IN ('pendente','agendado') AND data_agendada IN (base, base + interval '1 day')) = 2;
  ASSERT (SELECT data_agendada FROM conteudos_instagram WHERE status = 'publicado') = base + interval '3 days', 'mexeu em publicado';
  ASSERT (SELECT data_agendada FROM conteudos_instagram WHERE status = 'erro') = base + interval '4 days', 'mexeu em erro';
  ASSERT (SELECT data_agendada FROM conteudos_instagram WHERE tipo = 'carrossel') = base + interval '1 day', 'mexeu em outro tipo';
  ASSERT (SELECT data_agendada FROM conteudos_instagram WHERE data_agendada < base) = base - interval '1 day', 'mexeu em item antes da vaga';
  ASSERT puxar_fila('reel', now() - interval '1 hour') = 0, 'não pode puxar para o passado';
  RAISE NOTICE 'ok: puxar_fila';
END $$;

-- 5. reservar_conteudos_para_publicar ----------------------------------------
TRUNCATE conteudos_instagram;
INSERT INTO conteudos_instagram (id, tipo, data_agendada, midia_urls, status, tentativas, publicando_desde) VALUES
  ('00000000-0000-0000-0000-000000000001', 'reel', now() - interval '2 hours', '{https://x/v.mp4}', 'agendado', 0, NULL),
  ('00000000-0000-0000-0000-000000000002', 'reel', now() - interval '1 hour',  '{https://x/v.mp4}', 'agendado', 0, NULL),
  ('00000000-0000-0000-0000-000000000003', 'reel', now() + interval '1 hour',  '{https://x/v.mp4}', 'agendado', 0, NULL),
  ('00000000-0000-0000-0000-000000000004', 'reel', now() - interval '1 hour',  '{https://x/v.mp4}', 'pendente', 0, NULL),
  ('00000000-0000-0000-0000-000000000005', 'reel', now() - interval '3 hours', '{https://x/v.mp4}', 'publicando', 0, now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-000000000006', 'reel', now() - interval '3 hours', '{https://x/v.mp4}', 'publicando', 2, now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-000000000007', 'reel', now() - interval '3 hours', '{https://x/v.mp4}', 'publicando', 0, now() - interval '5 minutes');
DO $$
DECLARE ids text[];
BEGIN
  SELECT array_agg(id::text ORDER BY data_agendada) INTO ids FROM reservar_conteudos_para_publicar(5);
  -- preso há 20 min com 0 tentativas volta e é pego de novo (é o mais antigo); o da 3ª vira erro
  ASSERT ids = ARRAY['00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'], format('reservados: %s', ids);
  ASSERT (SELECT tentativas FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000005') = 1;
  ASSERT (SELECT status FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000006') = 'erro';
  ASSERT (SELECT erro FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000006') LIKE 'a publicação anterior não terminou%';
  ASSERT (SELECT status FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000007') = 'publicando', 'preso há 5 min não deveria voltar';
  ASSERT (SELECT status FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000003') = 'agendado', 'futuro não deveria ser pego';
  ASSERT (SELECT status FROM conteudos_instagram WHERE id = '00000000-0000-0000-0000-000000000004') = 'pendente', 'pendente não deveria ser pego';
  ASSERT (SELECT count(*) FROM reservar_conteudos_para_publicar(5)) = 0, 'segunda rodada não pega nada';
  RAISE NOTICE 'ok: reservar_conteudos_para_publicar';
END $$;

-- 6. disparar_publicacao -------------------------------------------------------
TRUNCATE net.chamadas;
UPDATE configuracoes SET valor = 'https://exemplo.vercel.app/' WHERE chave = 'app_url';
INSERT INTO conteudos_instagram (tipo, data_agendada, midia_urls, status) VALUES ('reel', now() - interval '1 minute', '{https://x/v.mp4}', 'agendado');
DO $$
DECLARE c record;
BEGIN
  ASSERT disparar_publicacao() IS NOT NULL, 'deveria disparar com item vencido';
  SELECT * INTO c FROM net.chamadas ORDER BY id DESC LIMIT 1;
  ASSERT c.url = 'https://exemplo.vercel.app/api/cron/publicar', c.url;
  ASSERT c.headers->>'x-cron-secret' = (SELECT valor FROM configuracoes WHERE chave = 'cron_secret');
  ASSERT c.timeout = 290000;
  ASSERT (SELECT schedule FROM cron.job WHERE jobname = 'publicar-conteudos') = '*/5 * * * *';
  RAISE NOTICE 'ok: disparar_publicacao';
END $$;

\echo 'SQL: todos os testes passaram'
