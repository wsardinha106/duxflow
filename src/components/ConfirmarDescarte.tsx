"use client";
import { useState } from "react";
import type { Conteudo } from "@/lib/tipos";
import { formatarDataHora } from "@/lib/regras/datas";
import { Modal } from "./Modal";

export function ConfirmarDescarte({
  conteudo,
  aoFechar,
  aoConfirmar,
}: {
  conteudo: Conteudo | null;
  aoFechar: () => void;
  aoConfirmar: (puxar: boolean) => void;
}) {
  return (
    <Modal aberto={!!conteudo} aoFechar={aoFechar} titulo="Descartar este conteúdo?">
      {conteudo && <Corpo key={conteudo.id} conteudo={conteudo} aoFechar={aoFechar} aoConfirmar={aoConfirmar} />}
    </Modal>
  );
}

function Corpo({ conteudo, aoFechar, aoConfirmar }: { conteudo: Conteudo; aoFechar: () => void; aoConfirmar: (puxar: boolean) => void }) {
  // Só oferece "puxar a fila" se a vaga ainda está no futuro (a função SQL não puxa para o passado).
  const [agora] = useState(() => Date.now());
  const futuro = new Date(conteudo.data_agendada).getTime() > agora;
  return (
        <>
          <p className="text-sm text-zinc-600">
            {conteudo.tipo === "reel" ? "Reel" : "Carrossel"} de {formatarDataHora(conteudo.data_agendada)}.
            {futuro ? " Quer puxar os próximos um dia para cobrir a vaga?" : ""}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {futuro && (
              <button type="button" className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white" onClick={() => aoConfirmar(true)}>
                Descartar e puxar os próximos um dia
              </button>
            )}
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${futuro ? "border border-zinc-300" : "bg-zinc-900 text-white"}`}
              onClick={() => aoConfirmar(false)}
            >
              {futuro ? "Só descartar (deixar a vaga livre)" : "Descartar"}
            </button>
            <button type="button" className="px-4 py-2 text-sm text-zinc-500" onClick={aoFechar}>
              Cancelar
            </button>
          </div>
        </>
  );
}
