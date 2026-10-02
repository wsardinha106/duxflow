import { ROTULO_STATUS } from "@/lib/regras/estados";
import type { Status } from "@/lib/tipos";

export const COR_STATUS: Record<Status, { fundo: string; texto: string; ponto: string; borda: string }> = {
  pendente: { fundo: "bg-amber-50", texto: "text-amber-800", ponto: "bg-amber-500", borda: "border-amber-400" },
  agendado: { fundo: "bg-sky-50", texto: "text-sky-800", ponto: "bg-sky-500", borda: "border-sky-500" },
  publicando: { fundo: "bg-violet-50", texto: "text-violet-800", ponto: "bg-violet-500", borda: "border-violet-500" },
  publicado: { fundo: "bg-emerald-50", texto: "text-emerald-800", ponto: "bg-emerald-500", borda: "border-emerald-500" },
  erro: { fundo: "bg-red-50", texto: "text-red-800", ponto: "bg-red-500", borda: "border-red-500" },
  descartado: { fundo: "bg-zinc-100", texto: "text-zinc-500", ponto: "bg-zinc-400", borda: "border-zinc-300" },
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
