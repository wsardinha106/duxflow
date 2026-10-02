-- Funções (RPC) da fila. Todas usadas só pelo servidor/skill (service role).

-- Horário (Brasília) de cada tipo. Mantenha igual a src/config/cliente.ts
-- (um teste confere).
CREATE OR REPLACE FUNCTION conteudo_hora_do_slot(p_tipo text)
RETURNS time
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_tipo = 'reel' THEN RETURN time '06:00'; END IF;
  IF p_tipo = 'carrossel' THEN RETURN time '15:00'; END IF;
  RAISE EXCEPTION 'Tipo inválido: % (use reel ou carrossel)', p_tipo;
END $$;

-- Próximo dia (a partir de hoje, se o slot de hoje ainda não passou) sem item
-- do mesmo tipo que não esteja descartado. Um por dia de cada tipo.
CREATE OR REPLACE FUNCTION proxima_data_livre(p_tipo text)
RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_hora time := conteudo_hora_do_slot(p_tipo);   -- lança erro se o tipo for inválido
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dia  date;
  v_slot timestamptz;
BEGIN
  FOR i IN 0..730 LOOP
    v_dia  := v_hoje + i;
    v_slot := (v_dia + v_hora) AT TIME ZONE 'America/Sao_Paulo';
    CONTINUE WHEN v_slot <= now();
    IF NOT EXISTS (
      SELECT 1 FROM conteudos_instagram
      WHERE tipo = p_tipo
        AND status <> 'descartado'
        AND (data_agendada AT TIME ZONE 'America/Sao_Paulo')::date = v_dia
    ) THEN
      RETURN v_slot;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Nenhuma data livre para % nos próximos 730 dias', p_tipo;
END $$;

-- Ao descartar com "puxar a fila": pendentes/agendados do mesmo tipo com data
-- depois da vaga sobem 1 dia. Nunca mexe em publicado. Não puxa para o passado.
CREATE OR REPLACE FUNCTION puxar_fila(p_tipo text, p_a_partir_de timestamptz)
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total int;
BEGIN
  PERFORM conteudo_hora_do_slot(p_tipo);
  IF p_a_partir_de <= now() THEN
    RETURN 0;
  END IF;
  UPDATE conteudos_instagram
     SET data_agendada = data_agendada - interval '1 day'
   WHERE tipo = p_tipo
     AND status IN ('pendente','agendado')
     AND data_agendada > p_a_partir_de;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END $$;

-- Reserva os itens a publicar:
-- 1) devolve à fila quem está "publicando" há mais de 15 min (na 3ª vira erro);
-- 2) marca como "publicando" os agendados vencidos, sem nunca pegar o mesmo
--    item em duas rodadas simultâneas (FOR UPDATE SKIP LOCKED).
CREATE OR REPLACE FUNCTION reservar_conteudos_para_publicar(p_limite int DEFAULT 5)
RETURNS SETOF conteudos_instagram
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE conteudos_instagram
     SET tentativas       = tentativas + 1,
         status           = CASE WHEN tentativas + 1 >= 3 THEN 'erro' ELSE 'agendado' END,
         erro             = 'a publicação anterior não terminou — tentando de novo',
         publicando_desde = NULL
   WHERE status = 'publicando'
     AND (publicando_desde IS NULL OR publicando_desde < now() - interval '15 minutes');

  RETURN QUERY
  WITH alvo AS (
    SELECT id
      FROM conteudos_instagram
     WHERE status = 'agendado'
       AND data_agendada <= now()
     ORDER BY data_agendada
     LIMIT GREATEST(p_limite, 0)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE conteudos_instagram c
     SET status = 'publicando',
         publicando_desde = now()
    FROM alvo
   WHERE c.id = alvo.id
  RETURNING c.*;
END $$;

-- Nenhuma destas funções é para o navegador.
REVOKE ALL ON FUNCTION conteudo_hora_do_slot(text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION proxima_data_livre(text)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION puxar_fila(text, timestamptz)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reservar_conteudos_para_publicar(int)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION conteudo_hora_do_slot(text)              TO service_role;
GRANT EXECUTE ON FUNCTION proxima_data_livre(text)                 TO service_role;
GRANT EXECUTE ON FUNCTION puxar_fila(text, timestamptz)            TO service_role;
GRANT EXECUTE ON FUNCTION reservar_conteudos_para_publicar(int)    TO service_role;
