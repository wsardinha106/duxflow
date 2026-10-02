import type { Status } from "@/lib/tipos";

export type Acao =
  | "aprovar"
  | "descartar"
  | "editar"
  | "publicar_agora"
  | "voltar_pendente"
  | "tentar_de_novo";

/** Tabela da §7: ações permitidas no painel para cada status. */
const ACOES_POR_STATUS: Record<Status, readonly Acao[]> = {
  pendente: ["aprovar", "descartar", "editar", "publicar_agora"],
  agendado: ["descartar", "editar", "publicar_agora", "voltar_pendente"],
  erro: ["tentar_de_novo", "descartar", "editar", "publicar_agora"],
  publicando: [],
  publicado: [],
  descartado: ["voltar_pendente"],
};

export const ROTULO_STATUS: Record<Status, string> = {
  pendente: "Pendente",
  agendado: "Agendado",
  publicando: "Publicando",
  publicado: "Publicado",
  erro: "Com erro",
  descartado: "Descartado",
};

export const ROTULO_ACAO: Record<Acao, string> = {
  aprovar: "Aprovar",
  descartar: "Descartar",
  editar: "Editar",
  publicar_agora: "Publicar agora",
  voltar_pendente: "Voltar para pendente",
  tentar_de_novo: "Tentar de novo",
};

export function acoesPermitidas(status: Status): readonly Acao[] {
  return ACOES_POR_STATUS[status] ?? [];
}

export function podeExecutar(status: Status, acao: Acao): boolean {
  return acoesPermitidas(status).includes(acao);
}

/** Status de origem de onde a ação é permitida (para usar como filtro no UPDATE). */
export function statusQuePermitem(acao: Acao): Status[] {
  return (Object.keys(ACOES_POR_STATUS) as Status[]).filter((s) => ACOES_POR_STATUS[s].includes(acao));
}

/** Status resultante de uma ação. Lança erro se a transição não é permitida. */
export function statusApos(status: Status, acao: Acao): Status {
  if (!podeExecutar(status, acao)) {
    throw new Error(`Não é possível "${ROTULO_ACAO[acao].toLowerCase()}" um conteúdo ${ROTULO_STATUS[status].toLowerCase()}.`);
  }
  switch (acao) {
    case "aprovar":
    case "tentar_de_novo":
      return "agendado";
    case "descartar":
      return "descartado";
    case "voltar_pendente":
      return "pendente";
    case "publicar_agora":
      return "publicando";
    case "editar":
      return status;
  }
}
