import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteInstagram, type ClienteInstagram, type FetchLike } from "@/lib/instagram/api";
import { montarLegenda } from "@/lib/regras/legenda";
import { mascararMensagem, statusAposFalha, validarParaPublicar } from "@/lib/regras/publicacao";
import type { Conteudo } from "@/lib/tipos";
import { CHAVES, gravarConfiguracoes, lerToken } from "./configuracoes";
import { renovarTokenSeNecessario, type ResultadoRenovacao } from "./token";

export type ResultadoItem =
  | { id: string; ok: true; permalink: string | null }
  | { id: string; ok: false; erro: string; status: Conteudo["status"] };

/**
 * Publica um item que já está reservado como `publicando` e grava o resultado.
 * Nunca lança: falhas viram `agendado` (até a 3ª) ou `erro`.
 */
export async function publicarItemReservado(
  admin: SupabaseClient,
  ig: ClienteInstagram,
  igUserId: string,
  item: Conteudo,
  token: string,
): Promise<ResultadoItem> {
  try {
    const invalido = validarParaPublicar(item);
    if (invalido) throw new Error(invalido);
    const legenda = montarLegenda(item.descricao, item.hashtags);
    const r =
      item.tipo === "reel"
        ? await ig.publicarReel(igUserId, { videoUrl: item.midia_urls[0], legenda, capaUrl: item.capa_url })
        : await ig.publicarCarrossel(igUserId, { imagens: item.midia_urls, legenda, altText: item.alt_text });

    const { error } = await admin
      .from("conteudos_instagram")
      .update({
        status: "publicado",
        ig_media_id: r.mediaId,
        ig_container_id: r.containerId,
        ig_permalink: r.permalink,
        publicado_em: new Date().toISOString(),
        conta_instagram_id: igUserId,
        erro: null,
        publicando_desde: null,
      })
      .eq("id", item.id);
    if (error) console.error(`[publicador] publicado mas não gravou ${item.id}: ${error.message}`);
    return { id: item.id, ok: true, permalink: r.permalink };
  } catch (e) {
    const erro = mascararMensagem(e, token);
    const { status, tentativas } = statusAposFalha(item.tentativas);
    await admin
      .from("conteudos_instagram")
      .update({ status, tentativas, erro, publicando_desde: null })
      .eq("id", item.id);
    return { id: item.id, ok: false, erro, status };
  }
}

/** Marca um item reservado de volta como falha sem chamar a Meta (ex.: sem token). */
async function falharReservados(admin: SupabaseClient, itens: Conteudo[], erro: string): Promise<ResultadoItem[]> {
  const r: ResultadoItem[] = [];
  for (const item of itens) {
    const { status, tentativas } = statusAposFalha(item.tentativas);
    await admin.from("conteudos_instagram").update({ status, tentativas, erro, publicando_desde: null }).eq("id", item.id);
    r.push({ id: item.id, ok: false, erro, status });
  }
  return r;
}

/** Abre o cliente do Instagram e descobre o ig_user_id (um /me por rodada). */
export async function abrirInstagram(
  admin: SupabaseClient,
  opcoes: { fetch?: FetchLike } = {},
): Promise<{ ig: ClienteInstagram; igUserId: string; token: string } | null> {
  const token = await lerToken(admin);
  if (!token) return null;
  const ig = criarClienteInstagram({ token, fetch: opcoes.fetch });
  const perfil = await ig.me();
  const igUserId = String(perfil.user_id);
  await gravarConfiguracoes(admin, { [CHAVES.userId]: igUserId, [CHAVES.username]: perfil.username ?? null });
  return { ig, igUserId, token };
}

export interface ResumoRodada {
  renovacao: ResultadoRenovacao;
  processados: number;
  publicados: number;
  falhas: number;
  itens: ResultadoItem[];
}

export class SemTokenError extends Error {
  constructor() {
    super("O Instagram não está conectado: nenhum token salvo. Cole um token em Conexões.");
  }
}

/** Uma rodada do cron: renova o token se preciso, reserva e publica em sequência. */
export async function rodadaDePublicacao(admin: SupabaseClient, opcoes: { fetch?: FetchLike } = {}): Promise<ResumoRodada> {
  const renovacao = await renovarTokenSeNecessario(admin, opcoes);
  const token = await lerToken(admin);
  if (!token) throw new SemTokenError();

  const { data, error } = await admin.rpc("reservar_conteudos_para_publicar", { p_limite: 5 });
  if (error) throw new Error(`Falha ao reservar conteúdos: ${error.message}`);
  const reservados = (data ?? []) as Conteudo[];
  if (!reservados.length) return { renovacao, processados: 0, publicados: 0, falhas: 0, itens: [] };

  let itens: ResultadoItem[] = [];
  let conexao: Awaited<ReturnType<typeof abrirInstagram>> = null;
  try {
    conexao = await abrirInstagram(admin, opcoes);
  } catch (e) {
    itens = await falharReservados(admin, reservados, mascararMensagem(e, token));
  }
  if (!conexao && !itens.length) itens = await falharReservados(admin, reservados, new SemTokenError().message);
  if (conexao) {
    // Em sequência: a Meta limita publicações por hora e vídeos em paralelo só dobram a espera.
    for (const item of reservados) itens.push(await publicarItemReservado(admin, conexao.ig, conexao.igUserId, item, conexao.token));
  }
  const publicados = itens.filter((i) => i.ok).length;
  return { renovacao, processados: itens.length, publicados, falhas: itens.length - publicados, itens };
}
