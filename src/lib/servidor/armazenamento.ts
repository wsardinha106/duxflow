import type { SupabaseClient } from "@supabase/supabase-js";
import { arquivosParaApagar, BUCKET } from "@/lib/regras/armazenamento";
import type { Conteudo } from "@/lib/tipos";

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
