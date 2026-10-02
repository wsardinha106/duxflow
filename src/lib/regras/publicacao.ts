import type { Conteudo, Status } from "@/lib/tipos";

export const MAX_TENTATIVAS = 3;
export const LIMITE_MENSAGEM_ERRO = 500;

/** Depois de uma falha: volta para `agendado` até a 3ª tentativa, depois `erro`. */
export function statusAposFalha(tentativasAntes: number): { status: Status; tentativas: number } {
  const tentativas = Math.max(0, tentativasAntes || 0) + 1;
  return { status: tentativas >= MAX_TENTATIVAS ? "erro" : "agendado", tentativas };
}

/** Esconde tokens em mensagens de erro e corta em 500 caracteres. */
export function mascararMensagem(mensagem: unknown, token?: string | null): string {
  let texto = mensagem instanceof Error ? mensagem.message : String(mensagem ?? "");
  if (token && token.length >= 8) texto = texto.split(token).join("***");
  texto = texto
    .replace(/(access_token=)[^&\s"']+/gi, "$1***")
    .replace(/("access_token"\s*:\s*")[^"]*"/gi, '$1***"')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-|]+/gi, "$1***");
  return texto.length > LIMITE_MENSAGEM_ERRO ? texto.slice(0, LIMITE_MENSAGEM_ERRO) : texto;
}

/** Validação antes de chamar a Meta. Devolve a mensagem de erro ou null. */
export function validarParaPublicar(item: Pick<Conteudo, "tipo" | "midia_urls" | "capa_url">): string | null {
  const urls = item.midia_urls ?? [];
  if (item.tipo === "reel" && urls.length !== 1) return "Reel precisa de exatamente 1 vídeo.";
  if (item.tipo === "carrossel" && (urls.length < 2 || urls.length > 10)) return "Carrossel precisa de 2 a 10 imagens.";
  if (item.tipo !== "reel" && item.tipo !== "carrossel") return "Tipo de conteúdo inválido.";
  const todas = item.capa_url ? [...urls, item.capa_url] : urls;
  for (const url of todas) {
    if (!/^https:\/\/\S+$/i.test(url ?? "")) return `Toda mídia precisa ser um link https:// (recebido: "${String(url).slice(0, 80)}").`;
  }
  return null;
}

/** Tradução do erro técnico para algo que o cliente entende. */
export function erroEmLinguagemHumana(erro: string | null | undefined): string | null {
  if (!erro) return null;
  const e = erro.toLowerCase();
  if (/sem token|token do instagram não|nenhum token/.test(e)) return "O Instagram não está conectado. Vá em Conexões e cole um token.";
  if (/code[":\s]*190|session has expired|error validating access token|invalid oauth|token.*(expir|venc|invál)/.test(e))
    return "O token do Instagram venceu ou foi recusado. Vá em Conexões e cole um token novo.";
  if (/application request limit|rate limit|code[":\s]*(4|9|17|32|613)\b|limite/.test(e))
    return "A Meta limitou as publicações por agora. Vamos tentar de novo em alguns minutos.";
  if (/permission|permiss|code[":\s]*(10|200)\b/.test(e))
    return "O token não tem permissão para publicar. Gere um token com instagram_business_content_publish.";
  if (/media|download|fetch|url|aspect|ratio|format|codec|duration/.test(e) && /(error|erro|fail|falh|invalid|unsupported)/.test(e))
    return `A Meta não aceitou o arquivo. Confira formato e tamanho. Detalhe: ${erro}`;
  if (/não terminou/.test(e)) return "A publicação anterior não terminou — vamos tentar de novo.";
  return erro;
}
