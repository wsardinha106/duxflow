import { ROTULO_STATUS } from "@/lib/regras/estados";
import type { Status } from "@/lib/tipos";

/** Cores de cada status: fundo/texto claros, ponto e borda, e o selo cheio (sobre a imagem). */
export const COR_STATUS: Record<Status, { fundo: string; texto: string; ponto: string; borda: string; solido: string }> = {
  pendente: { fundo: "bg-amber-50", texto: "text-amber-800", ponto: "bg-amber-400", borda: "border-amber-400", solido: "bg-amber-400 text-white" },
  agendado: { fundo: "bg-violet-50", texto: "text-violet-800", ponto: "bg-violet-500", borda: "border-violet-500", solido: "bg-violet-500 text-white" },
  publicando: { fundo: "bg-sky-50", texto: "text-sky-800", ponto: "bg-sky-500", borda: "border-sky-500", solido: "bg-sky-500 text-white" },
  publicado: { fundo: "bg-emerald-50", texto: "text-emerald-800", ponto: "bg-emerald-500", borda: "border-emerald-500", solido: "bg-emerald-500 text-white" },
  erro: { fundo: "bg-red-50", texto: "text-red-800", ponto: "bg-red-500", borda: "border-red-500", solido: "bg-red-500 text-white" },
  descartado: { fundo: "bg-zinc-100", texto: "text-zinc-500", ponto: "bg-zinc-400", borda: "border-zinc-300", solido: "bg-zinc-500 text-white" },
};

export function BadgeStatus({ status }: { status: Status }) {
  const c = COR_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${c.fundo} ${c.texto}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.ponto} ${status === "publicando" ? "animate-pulse" : ""}`} />
      {ROTULO_STATUS[status]}
    </span>
  );
}

/** Selo cheio para ficar por cima da miniatura. */
export function SeloStatus({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 shadow-sm md:text-xs ${COR_STATUS[status].solido} ${className}`}>
      {status === "erro" ? "Erro" : ROTULO_STATUS[status]}
    </span>
  );
}
