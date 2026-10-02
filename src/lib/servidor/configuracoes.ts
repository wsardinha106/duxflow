import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Leitura/escrita da tabela fechada `configuracoes` (só service role).
 * É o único lugar que conhece o nome da chave do token — nada aqui é
 * devolvido ao navegador.
 */
export const CHAVES = {
  token: "ig_access_token",
  renovadoEm: "ig_token_renovado_em",
  expiraEm: "ig_token_expira_em",
  username: "ig_username",
  userId: "ig_user_id",
  erroToken: "ig_token_erro",
  cronSecret: "cron_secret",
} as const;

export type ChaveConfig = (typeof CHAVES)[keyof typeof CHAVES];

export async function lerConfiguracoes(admin: SupabaseClient, chaves: ChaveConfig[]): Promise<Partial<Record<ChaveConfig, string>>> {
  const { data, error } = await admin.from("configuracoes").select("chave, valor").in("chave", chaves);
  if (error) throw new Error(`Não foi possível ler as configurações: ${error.message}`);
  const r: Partial<Record<ChaveConfig, string>> = {};
  for (const linha of data ?? []) if (linha.valor !== null) r[linha.chave as ChaveConfig] = linha.valor;
  return r;
}

export async function lerConfiguracao(admin: SupabaseClient, chave: ChaveConfig): Promise<string | null> {
  return (await lerConfiguracoes(admin, [chave]))[chave] ?? null;
}

/** Grava (ou apaga, com null) várias chaves de uma vez. */
export async function gravarConfiguracoes(admin: SupabaseClient, valores: Partial<Record<ChaveConfig, string | null>>): Promise<void> {
  const agora = new Date().toISOString();
  const linhas = Object.entries(valores).map(([chave, valor]) => ({ chave, valor: valor ?? null, updated_at: agora }));
  if (!linhas.length) return;
  const { error } = await admin.from("configuracoes").upsert(linhas, { onConflict: "chave" });
  if (error) throw new Error(`Não foi possível gravar as configurações: ${error.message}`);
}

export async function lerToken(admin: SupabaseClient): Promise<string | null> {
  return lerConfiguracao(admin, CHAVES.token);
}
