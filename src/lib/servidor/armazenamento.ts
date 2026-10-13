import type { SupabaseClient } from "@supabase/supabase-js";
import { arquivosParaApagar, BUCKET } from "@/lib/regras/armazenamento";
import { deveRenovar } from "@/lib/regras/token";
import type { Conteudo } from "@/lib/tipos";
import { CHAVES, gravarConfiguracoes, lerConfiguracao } from "./configuracoes";

/** O Storage aceita até 1000 caminhos por chamada. */
const LOTE = 1000;

/**
 * Apaga do Storage os arquivos de conteúdos já publicados (ver arquivosParaApagar).
 * Arquivo que já não existe é ignorado. Devolve quantos arquivos saíram.
 */
export async function apagarMidiasPublicadas(admin: SupabaseClient, itens: Pick<Conteudo, "tipo" | "midia_urls" | "capa_url">[]): Promise<number> {
  const caminhos = [...new Set(itens.flatMap(arquivosParaApagar))];
  let apagados = 0;
  for (let i = 0; i < caminhos.length; i += LOTE) {
    const { data, error } = await admin.storage.from(BUCKET).remove(caminhos.slice(i, i + LOTE));
    if (error) throw new Error(`Falha ao apagar arquivos do Storage: ${error.message}`);
    apagados += data?.length ?? 0;
  }
  return apagados;
}

const PAGINA = 1000;

/** Apaga os arquivos de TODOS os conteúdos já publicados (idempotente). */
export async function limparTodosPublicados(admin: SupabaseClient): Promise<{ conteudos: number; arquivos: number }> {
  const publicados: Pick<Conteudo, "tipo" | "midia_urls" | "capa_url">[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await admin
      .from("conteudos_instagram")
      .select("tipo, midia_urls, capa_url")
      .eq("status", "publicado")
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    publicados.push(...((data ?? []) as typeof publicados));
    if ((data ?? []).length < PAGINA) break;
  }
  const arquivos = await apagarMidiasPublicadas(admin, publicados);
  await gravarConfiguracoes(admin, { [CHAVES.limpezaEm]: new Date().toISOString() });
  return { conteudos: publicados.length, arquivos };
}

/**
 * Faxina automática chamada pelo cron: uma vez a cada 24h apaga o que ficou de
 * conteúdos publicados (inclusive os publicados antes desta limpeza existir).
 * Nunca lança: falha só vira log, para não travar a publicação.
 */
export async function limparPublicadosSeNecessario(admin: SupabaseClient, agora: Date = new Date()): Promise<string> {
  try {
    if (!deveRenovar(await lerConfiguracao(admin, CHAVES.limpezaEm), agora)) return "limpo há menos de 24h";
    const r = await limparTodosPublicados(admin);
    return `${r.arquivos} arquivo(s) apagado(s) de ${r.conteudos} publicado(s)`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[limpeza] ${msg}`);
    return `falha na limpeza: ${msg}`;
  }
}
