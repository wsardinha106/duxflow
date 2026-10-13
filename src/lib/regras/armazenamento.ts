import type { Conteudo } from "@/lib/tipos";

/** Bucket do Supabase Storage onde a skill sobe as mídias. */
export const BUCKET = "conteudos-instagram";

const MARCADOR = `/storage/v1/object/public/${BUCKET}/`;

/** Caminho do arquivo dentro do bucket, a partir da URL pública. URL de fora do bucket = null. */
export function caminhoNoBucket(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(MARCADOR);
  if (i < 0) return null;
  const caminho = url.slice(i + MARCADOR.length).split(/[?#]/)[0];
  if (!caminho) return null;
  try {
    return decodeURIComponent(caminho);
  } catch {
    return caminho;
  }
}

/**
 * Arquivos que podem sair do Storage depois que o conteúdo foi publicado:
 * o vídeo do reel e as fotos do carrossel. Fica só a miniatura do calendário
 * (a capa do reel e a 1ª foto do carrossel), que é leve.
 */
export function arquivosParaApagar(c: Pick<Conteudo, "tipo" | "midia_urls" | "capa_url">): string[] {
  const manter = new Set([caminhoNoBucket(c.tipo === "reel" ? c.capa_url : c.midia_urls[0])]);
  const caminhos = c.midia_urls.map(caminhoNoBucket).filter((p): p is string => !!p && !manter.has(p));
  return [...new Set(caminhos)];
}
