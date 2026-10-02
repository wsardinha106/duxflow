export const LIMITE_LEGENDA = 2200;
export const LIMITE_HASHTAGS = 30;
export const CORTE_MAIS = 125;

/**
 * Limpa uma lista de hashtags: tira `#`, espaços e pontuação, separa por
 * espaço/vírgula, remove repetidas (sem diferenciar maiúsculas) e corta em 30.
 * Devolve sem `#`.
 */
export function normalizarHashtags(entrada: readonly string[] | string | null | undefined): string[] {
  if (!entrada) return [];
  const brutas = (typeof entrada === "string" ? [entrada] : entrada).flatMap((t) => String(t).split(/[\s,;]+/));
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const bruta of brutas) {
    const tag = bruta.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!tag) continue;
    const chave = tag.toLocaleLowerCase("pt-BR");
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    resultado.push(tag);
    if (resultado.length >= LIMITE_HASHTAGS) break;
  }
  return resultado;
}

/**
 * Legenda exatamente como vai para o Instagram: descrição + linha em branco +
 * hashtags. Nunca passa de 2200 caracteres: hashtags que não cabem ficam de
 * fora; se só a descrição já passa do limite, ela é cortada.
 */
export function montarLegenda(descricao: string | null | undefined, hashtags: readonly string[] | null | undefined): string {
  const texto = (descricao ?? "").trim();
  const tags = normalizarHashtags(hashtags ?? []).map((t) => `#${t}`);

  if (texto.length >= LIMITE_LEGENDA) return texto.slice(0, LIMITE_LEGENDA).trimEnd();

  let linhaTags = "";
  for (const tag of tags) {
    const candidata = linhaTags ? `${linhaTags} ${tag}` : tag;
    const total = texto ? texto.length + 2 + candidata.length : candidata.length;
    if (total > LIMITE_LEGENDA) break;
    linhaTags = candidata;
  }
  if (!linhaTags) return texto;
  return texto ? `${texto}\n\n${linhaTags}` : linhaTags;
}

/** Divide o texto no ponto em que o Instagram mostra "mais". */
export function cortarNoMais(texto: string, corte = CORTE_MAIS): { visivel: string; resto: string } {
  const chars = Array.from(texto);
  return { visivel: chars.slice(0, corte).join(""), resto: chars.slice(corte).join("") };
}
