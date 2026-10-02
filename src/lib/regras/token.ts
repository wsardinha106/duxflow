export const INTERVALO_RENOVACAO_MS = 24 * 60 * 60 * 1000;

/** Renova se nunca renovou, se a data for inválida ou se já passaram 24h. */
export function deveRenovar(renovadoEm: string | null | undefined, agora: Date = new Date()): boolean {
  if (!renovadoEm) return true;
  const t = new Date(renovadoEm).getTime();
  if (Number.isNaN(t)) return true;
  return agora.getTime() - t >= INTERVALO_RENOVACAO_MS;
}
