"use client";
import { useState } from "react";
import { op } from "@/lib/painel/cliente";
import type { Conteudo } from "@/lib/tipos";
import type { CamposEdicao } from "@/lib/painel/ops";
import { useToast } from "./Toasts";

/** Executa as ações do painel com toasts e um "ocupado" para os botões. */
export function useAcoes(aoMudar: () => void) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function rodar<T>(chave: string, fn: () => Promise<T>, sucesso: (r: T) => string | null): Promise<T | undefined> {
    setOcupado(chave);
    try {
      const r = await fn();
      const msg = sucesso(r);
      if (msg) toast("sucesso", msg);
      aoMudar();
      return r;
    } catch (e) {
      toast("erro", e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setOcupado(null);
    }
  }

  return {
    ocupado,
    aprovar: (c: Conteudo) => rodar("aprovar", () => op("aprovar", c.id), () => "Aprovado e agendado."),
    aprovarTodos: () => rodar("aprovarTodos", () => op("aprovarTodosPendentes"), (n) => (n ? `${n} conteúdo(s) aprovado(s).` : "Nada pendente.")),
    descartar: (c: Conteudo, puxar: boolean) =>
      rodar("descartar", () => op("descartar", c.id, puxar), (r) => (puxar && r.puxados ? `Descartado. ${r.puxados} conteúdo(s) subiram um dia.` : "Descartado.")),
    voltarParaPendente: (c: Conteudo) => rodar("voltar_pendente", () => op("voltarParaPendente", c.id), () => "Voltou para pendente."),
    tentarDeNovo: (c: Conteudo) => rodar("tentar_de_novo", () => op("tentarDeNovo", c.id), () => "Agendado para tentar de novo."),
    editar: (c: Conteudo, campos: CamposEdicao) => rodar("editar", () => op("editar", c.id, campos), () => "Alterações salvas."),
    publicarAgora: async (c: Conteudo) => {
      setOcupado("publicar_agora");
      toast("info", "Publicando… vídeos podem levar até 4 minutos.");
      try {
        const r = await op("publicarAgora", c.id);
        if (r.ok) toast("sucesso", "Publicado!", r.permalink ? { href: r.permalink, rotulo: "Ver no Instagram" } : undefined);
        else toast("erro", `Não publicou: ${r.erro}`);
        return r;
      } catch (e) {
        toast("erro", e instanceof Error ? e.message : String(e));
      } finally {
        setOcupado(null);
        aoMudar();
      }
    },
  };
}
