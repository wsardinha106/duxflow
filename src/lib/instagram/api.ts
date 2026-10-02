/**
 * Cliente da Instagram API (login do Instagram), host graph.instagram.com.
 * O token vai sempre no header `Authorization: Bearer` e nunca na URL.
 * `fetch` e `esperar` são injetáveis para os testes não tocarem na rede.
 */
import { mascararMensagem } from "@/lib/regras/publicacao";

export const HOST = "https://graph.instagram.com";
export const VERSAO = "v21.0";
export const BASE = `${HOST}/${VERSAO}`;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcoesCliente {
  token: string;
  fetch?: FetchLike;
  esperar?: (ms: number) => Promise<void>;
  intervaloStatusMs?: number;
  tetoStatusMs?: number;
}

export class ErroInstagram extends Error {
  constructor(
    mensagem: string,
    readonly httpStatus?: number,
    readonly codigo?: number,
    readonly subcodigo?: number,
  ) {
    super(mensagem);
    this.name = "ErroInstagram";
  }

  /** Token vencido, revogado ou inválido. */
  get tokenRecusado(): boolean {
    return this.codigo === 190 || /access token|session has expired/i.test(this.message);
  }
}

export interface PerfilInstagram {
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export interface TokenRenovado {
  access_token: string;
  expires_in?: number;
}

export interface ResultadoPublicacao {
  containerId: string;
  mediaId: string;
  permalink: string | null;
}

const CAMPOS_PERFIL = "user_id,username,name,profile_picture_url,followers_count,media_count";

export function criarClienteInstagram(opcoes: OpcoesCliente) {
  const token = opcoes.token;
  const f: FetchLike = opcoes.fetch ?? ((url, init) => fetch(url, init));
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const intervalo = opcoes.intervaloStatusMs ?? 5000;
  const teto = opcoes.tetoStatusMs ?? 240_000;

  async function chamar<T>(metodo: "GET" | "POST", caminho: string, params?: Record<string, string | undefined>): Promise<T> {
    const limpos: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null) limpos[k] = v;
    const corpo = new URLSearchParams(limpos);
    let url = caminho.startsWith("http") ? caminho : `${BASE}${caminho}`;
    const init: RequestInit = { method: metodo, headers: { Authorization: `Bearer ${token}` }, cache: "no-store" };
    if (metodo === "GET") {
      const qs = corpo.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = corpo.toString();
    }

    let resp: Response;
    try {
      resp = await f(url, init);
    } catch (e) {
      throw new ErroInstagram(`Falha de rede ao falar com o Instagram: ${mascararMensagem(e, token)}`);
    }
    const texto = await resp.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      // resposta não-JSON
    }
    const erro = (json as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } } | null)?.error;
    if (!resp.ok || erro) {
      const msg = erro?.error_user_msg || erro?.message || texto.slice(0, 200) || `HTTP ${resp.status}`;
      const detalhe = erro?.code ? ` (code ${erro.code}${erro.error_subcode ? `/${erro.error_subcode}` : ""})` : "";
      throw new ErroInstagram(mascararMensagem(`${msg}${detalhe}`, token), resp.status, erro?.code, erro?.error_subcode);
    }
    return json as T;
  }

  /** `/me` — tenta com os campos completos; se a conta não liberar, só user_id e username. */
  async function me(): Promise<PerfilInstagram> {
    try {
      return await chamar<PerfilInstagram>("GET", "/me", { fields: CAMPOS_PERFIL });
    } catch (e) {
      if (e instanceof ErroInstagram && e.tokenRecusado) throw e;
      return await chamar<PerfilInstagram>("GET", "/me", { fields: "user_id,username" });
    }
  }

  /** Troca/renova por um token de 60 dias. */
  async function renovarToken(): Promise<TokenRenovado> {
    try {
      return await chamar<TokenRenovado>("GET", `${HOST}/refresh_access_token`, { grant_type: "ig_refresh_token" });
    } catch (e) {
      if (!(e instanceof ErroInstagram) || e.codigo === 190 || e.httpStatus === undefined) throw e;
      // Este endpoint é documentado com o token na query; se o header não bastar,
      // repete do jeito documentado (chamada servidor→Meta, erro sai mascarado).
      return chamar<TokenRenovado>("GET", `${HOST}/refresh_access_token`, {
        grant_type: "ig_refresh_token",
        access_token: token,
      });
    }
  }

  async function esperarFinalizar(containerId: string): Promise<void> {
    let decorrido = 0;
    for (;;) {
      const r = await chamar<{ status_code?: string; status?: string }>("GET", `/${containerId}`, { fields: "status_code,status" });
      const codigo = (r.status_code ?? "").toUpperCase();
      if (codigo === "FINISHED" || codigo === "PUBLISHED") return;
      if (codigo === "ERROR" || codigo === "EXPIRED") {
        throw new ErroInstagram(`O Instagram não conseguiu processar a mídia (${codigo}): ${r.status ?? "sem detalhe"}`);
      }
      if (decorrido >= teto) {
        throw new ErroInstagram(`O Instagram ainda estava processando a mídia depois de ${Math.round(teto / 1000)} s.`);
      }
      await esperar(intervalo);
      decorrido += intervalo;
    }
  }

  async function publicarContainer(igUserId: string, containerId: string): Promise<ResultadoPublicacao> {
    await esperarFinalizar(containerId);
    const pub = await chamar<{ id: string }>("POST", `/${igUserId}/media_publish`, { creation_id: containerId });
    let permalink: string | null = null;
    try {
      const r = await chamar<{ permalink?: string }>("GET", `/${pub.id}`, { fields: "permalink" });
      permalink = r.permalink ?? null;
    } catch {
      // segue sem permalink
    }
    return { containerId, mediaId: pub.id, permalink };
  }

  async function publicarReel(
    igUserId: string,
    dados: { videoUrl: string; legenda: string; capaUrl?: string | null },
  ): Promise<ResultadoPublicacao> {
    const c = await chamar<{ id: string }>("POST", `/${igUserId}/media`, {
      media_type: "REELS",
      video_url: dados.videoUrl,
      caption: dados.legenda,
      share_to_feed: "true",
      cover_url: dados.capaUrl || undefined,
    });
    return publicarContainer(igUserId, c.id);
  }

  async function publicarCarrossel(
    igUserId: string,
    dados: { imagens: string[]; legenda: string; altText?: string | null },
  ): Promise<ResultadoPublicacao> {
    const filhos: string[] = [];
    let usarAlt = Boolean(dados.altText);
    for (const imagem of dados.imagens) {
      const base = { image_url: imagem, is_carousel_item: "true" };
      let filho: { id: string };
      if (usarAlt) {
        try {
          filho = await chamar<{ id: string }>("POST", `/${igUserId}/media`, { ...base, alt_text: dados.altText! });
        } catch (e) {
          if (e instanceof ErroInstagram && e.tokenRecusado) throw e;
          // A Meta recusou alt_text: refaz sem ele (o texto continua no banco).
          usarAlt = false;
          filho = await chamar<{ id: string }>("POST", `/${igUserId}/media`, base);
        }
      } else {
        filho = await chamar<{ id: string }>("POST", `/${igUserId}/media`, base);
      }
      filhos.push(filho.id);
    }
    const c = await chamar<{ id: string }>("POST", `/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: filhos.join(","),
      caption: dados.legenda,
    });
    return publicarContainer(igUserId, c.id);
  }

  return { me, renovarToken, esperarFinalizar, publicarReel, publicarCarrossel };
}

export type ClienteInstagram = ReturnType<typeof criarClienteInstagram>;
