-- Tabelas, RLS e bucket do painel de conteúdos do Instagram.

-- ---------------------------------------------------------------------------
-- conteudos_instagram
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conteudos_instagram (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_instagram_id  text,                       -- preenchido pelo publicador via /me
  tipo                text NOT NULL CHECK (tipo IN ('reel','carrossel')),
  status              text NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','agendado','publicando','publicado','erro','descartado')),
  data_agendada       timestamptz NOT NULL,

  midia_urls          text[] NOT NULL CHECK (array_length(midia_urls,1) >= 1),
  capa_url            text,
  descricao           text NOT NULL DEFAULT '',
  alt_text            text,
  hashtags            text[] NOT NULL DEFAULT '{}',
  palavra_chave       text,

  tema                text,
  origem_url          text,
  origem_trecho       text,
  nota                int CHECK (nota IS NULL OR nota BETWEEN 0 AND 10),

  ig_container_id     text,
  ig_media_id         text,
  ig_permalink        text,
  erro                text,
  tentativas          int NOT NULL DEFAULT 0,
  publicando_desde    timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  aprovado_em         timestamptz,
  publicado_em        timestamptz,

  CONSTRAINT midia_por_tipo CHECK (
    (tipo = 'reel'      AND array_length(midia_urls,1) = 1) OR
    (tipo = 'carrossel' AND array_length(midia_urls,1) BETWEEN 2 AND 10)
  )
);
CREATE INDEX IF NOT EXISTS conteudos_instagram_status_data_idx ON conteudos_instagram (status, data_agendada);
CREATE INDEX IF NOT EXISTS conteudos_instagram_tipo_data_idx   ON conteudos_instagram (tipo, data_agendada);

-- Só usuário logado lê e altera; anon não vê nada. A skill e o servidor usam a
-- service role (passa por cima do RLS).
ALTER TABLE conteudos_instagram ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logado_le     ON conteudos_instagram;
DROP POLICY IF EXISTS logado_altera ON conteudos_instagram;
CREATE POLICY logado_le     ON conteudos_instagram FOR SELECT TO authenticated USING (true);
CREATE POLICY logado_altera ON conteudos_instagram FOR UPDATE TO authenticated USING (true);
REVOKE ALL ON conteudos_instagram FROM anon;

-- ---------------------------------------------------------------------------
-- configuracoes (segredos) — FECHADA: só service role.
-- Lição aprendida: sem RLS + REVOKE, a chave pública lia o token do Instagram.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracoes (
  chave      text PRIMARY KEY,
  valor      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON configuracoes FROM anon, authenticated;   -- só service role
REVOKE ALL ON configuracoes FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Bucket público para leitura (a Meta baixa o arquivo pela URL).
-- Upload só com service role ou usuário logado.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('conteudos-instagram', 'conteudos-instagram', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS conteudos_instagram_upload_logado ON storage.objects;
CREATE POLICY conteudos_instagram_upload_logado ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conteudos-instagram');
