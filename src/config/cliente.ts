/**
 * Dados deste cliente (§0 do prompt). Preencha antes do deploy.
 *
 * Os horários dos slots também estão na função SQL `conteudo_hora_do_slot`
 * (supabase/migrations/0002_funcoes.sql). Um teste falha se os dois
 * divergirem — ao mudar aqui, mude lá também.
 */
export const CLIENTE = {
  /** Nome do painel na barra superior. */
  marca: "DuxFlow",
  nome: "Nome do cliente",
  instagram: "@cliente",
  urlProducao: "https://cliente.vercel.app",
} as const;

export const FUSO = "America/Sao_Paulo";

export type TipoConteudo = "reel" | "carrossel";

/** Horário (Brasília) em que cada tipo é publicado. */
export const HORA_DO_SLOT: Record<TipoConteudo, { hora: number; minuto: number }> = {
  reel: { hora: 6, minuto: 0 },
  carrossel: { hora: 15, minuto: 0 },
};
