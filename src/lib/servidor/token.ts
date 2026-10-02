import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteInstagram, ErroInstagram, type FetchLike } from "@/lib/instagram/api";
import { deveRenovar } from "@/lib/regras/token";
import { mascararMensagem } from "@/lib/regras/publicacao";
import { CHAVES, gravarConfiguracoes, lerConfiguracoes } from "./configuracoes";

export interface ResultadoRenovacao {
  renovado: boolean;
  motivo: string;
}

function expiraEm(expiresIn: number | undefined, agora: Date): string | null {
  return typeof expiresIn === "number" && expiresIn > 0 ? new Date(agora.getTime() + expiresIn * 1000).toISOString() : null;
}

/**
 * Renova o token se já passaram 24h desde a última renovação. Se falhar, NÃO
 * apaga o token antigo (ele vale até vencer) e guarda o erro para Conexões.
 */
export async function renovarTokenSeNecessario(
  admin: SupabaseClient,
  opcoes: { fetch?: FetchLike; agora?: Date } = {},
): Promise<ResultadoRenovacao> {
  const agora = opcoes.agora ?? new Date();
  const cfg = await lerConfiguracoes(admin, [CHAVES.token, CHAVES.renovadoEm]);
  const token = cfg[CHAVES.token];
  if (!token) return { renovado: false, motivo: "sem token" };
  if (!deveRenovar(cfg[CHAVES.renovadoEm], agora)) return { renovado: false, motivo: "renovado há menos de 24h" };

  try {
    const r = await criarClienteInstagram({ token, fetch: opcoes.fetch }).renovarToken();
    if (!r.access_token) throw new Error("A Meta não devolveu um token novo.");
    await gravarConfiguracoes(admin, {
      [CHAVES.token]: r.access_token,
      [CHAVES.renovadoEm]: agora.toISOString(),
      [CHAVES.expiraEm]: expiraEm(r.expires_in, agora),
      [CHAVES.erroToken]: null,
    });
    return { renovado: true, motivo: "token renovado" };
  } catch (e) {
    const msg = mascararMensagem(e, token);
    await gravarConfiguracoes(admin, { [CHAVES.erroToken]: `${agora.toISOString()} ${msg}` });
    return { renovado: false, motivo: `falha ao renovar: ${msg}` };
  }
}

export interface ResultadoConexao {
  username: string;
  userId: string;
  expiraEm: string | null;
  renovadoAgora: boolean;
}

/**
 * Valida um token colado em Conexões, tenta trocá-lo por um de 60 dias e grava.
 * Se a Meta recusar a troca (ex.: token com menos de 24h), guarda o original.
 */
export async function conectarToken(
  admin: SupabaseClient,
  tokenColado: string,
  opcoes: { fetch?: FetchLike; agora?: Date } = {},
): Promise<ResultadoConexao> {
  const agora = opcoes.agora ?? new Date();
  const token = tokenColado.trim();
  if (token.length < 20 || /\s/.test(token)) throw new Error("Isso não parece um token do Instagram. Copie o token inteiro e cole aqui.");

  const ig = criarClienteInstagram({ token, fetch: opcoes.fetch });
  let perfil;
  try {
    perfil = await ig.me();
  } catch (e) {
    if (e instanceof ErroInstagram && e.tokenRecusado) throw new Error("O Instagram recusou este token (vencido ou inválido). Gere um novo e cole aqui.");
    throw new Error(`Não foi possível validar o token: ${mascararMensagem(e, token)}`);
  }

  let tokenFinal = token;
  let expira: string | null = null;
  let renovadoAgora = false;
  try {
    const r = await ig.renovarToken();
    if (r.access_token) {
      tokenFinal = r.access_token;
      expira = expiraEm(r.expires_in, agora);
      renovadoAgora = true;
    }
  } catch {
    // Token novo demais para renovar: guarda o original; o cron renova depois.
  }

  await gravarConfiguracoes(admin, {
    [CHAVES.token]: tokenFinal,
    [CHAVES.userId]: String(perfil.user_id ?? ""),
    [CHAVES.username]: perfil.username ?? "",
    // Mesmo sem renovar agora, o carimbo é "agora": a Meta só renova tokens
    // com 24h ou mais, que é exatamente quando o cron vai tentar.
    [CHAVES.renovadoEm]: agora.toISOString(),
    [CHAVES.expiraEm]: expira,
    [CHAVES.erroToken]: null,
  });
  return { username: perfil.username, userId: String(perfil.user_id), expiraEm: expira, renovadoAgora };
}
