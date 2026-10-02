-- Agendador no próprio banco (pg_cron + pg_net).
-- Lição aprendida: o cron do GitHub Actions atrasa e descarta execuções.
-- O agendador principal é o pg_cron, a cada 5 minutos.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

INSERT INTO configuracoes (chave, valor)
VALUES ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT DO NOTHING;

-- URL de produção (Vercel). AJUSTE depois do primeiro deploy:
--   UPDATE configuracoes SET valor = 'https://SEU-PROJETO.vercel.app', updated_at = now()
--    WHERE chave = 'app_url';
INSERT INTO configuracoes (chave, valor)
VALUES ('app_url', 'https://cliente.vercel.app')
ON CONFLICT DO NOTHING;

-- Chama a rota do publicador se houver item vencido, item preso em
-- "publicando", ou se for a rodada dos minutos 0–4 de cada hora (renovação do token).
CREATE OR REPLACE FUNCTION disparar_publicacao()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url     text;
  v_segredo text;
  v_req     bigint;
BEGIN
  SELECT valor INTO v_url     FROM configuracoes WHERE chave = 'app_url';
  SELECT valor INTO v_segredo FROM configuracoes WHERE chave = 'cron_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_segredo, '') = '' THEN
    RAISE NOTICE 'disparar_publicacao: configure app_url e cron_secret em configuracoes';
    RETURN NULL;
  END IF;

  IF extract(minute FROM now())::int % 60 >= 5
     AND NOT EXISTS (SELECT 1 FROM conteudos_instagram WHERE status = 'agendado' AND data_agendada <= now())
     AND NOT EXISTS (SELECT 1 FROM conteudos_instagram WHERE status = 'publicando' AND publicando_desde < now() - interval '15 minutes')
  THEN
    RETURN NULL;
  END IF;

  SELECT net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/publicar',
    headers := jsonb_build_object('x-cron-secret', v_segredo),
    timeout_milliseconds := 290000
  ) INTO v_req;
  RETURN v_req;
END $$;

REVOKE ALL ON FUNCTION disparar_publicacao() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publicar-conteudos') THEN
    PERFORM cron.unschedule('publicar-conteudos');
  END IF;
END $$;

SELECT cron.schedule('publicar-conteudos', '*/5 * * * *', 'SELECT disparar_publicacao()');
