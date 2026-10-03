"use client";
import { useCallback, useEffect, useState } from "react";
import { op } from "@/lib/painel/cliente";
import type { Conteudo } from "@/lib/tipos";
import { cortarNoMais } from "@/lib/regras/legenda";
import { formatarDataHora } from "@/lib/regras/datas";
import { Carrossel, VideoReel } from "./Previa";
import { DetalheConteudo } from "./DetalheConteudo";
import { ConfirmarDescarte } from "./ConfirmarDescarte";
import { useAcoes } from "./useAcoes";
import { useToast } from "./Toasts";

export function Fila() {
  const toast = useToast();
  const [itens, setItens] = useState<Conteudo[] | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [descartando, setDescartando] = useState<Conteudo | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await op("listarPendentes"));
    } catch (e) {
      toast("erro", e instanceof Error ? e.message : String(e));
      setItens((atual) => atual ?? []);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial
    void carregar();
  }, [carregar]);

  const acoes = useAcoes(carregar);
  const atual = itens?.find((c) => c.id === editando) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Fila de aprovação</h1>
          <p className="text-sm text-zinc-500">{itens ? `${itens.length} pendente(s)` : "Carregando…"}</p>
        </div>
        {!!itens?.length && (
          <button
            type="button"
            disabled={!!acoes.ocupado}
            onClick={() => window.confirm(`Aprovar todos os ${itens.length} pendentes?`) && acoes.aprovarTodos()}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
          >
            {acoes.ocupado === "aprovarTodos" ? "Aprovando…" : "Aprovar todos"}
          </button>
        )}
      </div>

      {itens && !itens.length && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-base font-semibold">Tudo em dia 🎉</p>
          <p className="mt-1 text-sm text-zinc-500">Nenhum conteúdo esperando aprovação.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {itens?.map((c) => (
          <CardFila
            key={c.id}
            c={c}
            ocupado={!!acoes.ocupado}
            aoAprovar={() => acoes.aprovar(c)}
            aoEditar={() => setEditando(c.id)}
            aoDescartar={() => setDescartando(c)}
          />
        ))}
      </div>

      <DetalheConteudo key={atual?.id ?? "nenhum"} conteudo={atual} editarAoAbrir aoFechar={() => setEditando(null)} aoMudar={carregar} />
      <ConfirmarDescarte
        conteudo={descartando}
        aoFechar={() => setDescartando(null)}
        aoConfirmar={async (puxar) => {
          const alvo = descartando!;
          setDescartando(null);
          await acoes.descartar(alvo, puxar);
        }}
      />
    </div>
  );
}

function CardFila({ c, ocupado, aoAprovar, aoEditar, aoDescartar }: { c: Conteudo; ocupado: boolean; aoAprovar: () => void; aoEditar: () => void; aoDescartar: () => void }) {
  const [aberta, setAberta] = useState(false);
  const { visivel, resto } = cortarNoMais(c.descricao);
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="bg-zinc-100">
        {c.tipo === "reel" ? (
          <div className="mx-auto max-w-[280px]">
            <VideoReel src={c.midia_urls[0]} capa={c.capa_url} className="aspect-[9/16] max-h-[420px]" />
          </div>
        ) : (
          <div className="mx-auto max-w-[360px] pb-6">
            <Carrossel imagens={c.midia_urls} alt={c.alt_text} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{formatarDataHora(c.data_agendada)}</span>
          <span className="text-zinc-500">· {c.tipo === "reel" ? "Reel" : `Carrossel com ${c.midia_urls.length}`}</span>
          {c.nota !== null && <span className="ml-auto rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">nota {c.nota}</span>}
        </div>
        {c.tema && <p className="text-xs font-medium uppercase tracking-wide text-pink-700">{c.tema}</p>}
        <p className="whitespace-pre-wrap break-words text-sm">
          <span>{visivel}</span>
          {resto && !aberta && (
            <button type="button" className="text-zinc-500" onClick={() => setAberta(true)}>
              {" "}| … mais
            </button>
          )}
          {resto && aberta && <span className="text-zinc-600">{resto}</span>}
        </p>
        {!!c.hashtags.length && <p className="break-words text-sm text-sky-700">{c.hashtags.map((h) => `#${h}`).join(" ")}</p>}
        {c.origem_url && (
          <p className="text-xs text-zinc-500">
            Origem:{" "}
            <a href={c.origem_url} target="_blank" rel="noreferrer" className="break-all underline">
              {c.origem_url}
            </a>
            {c.origem_trecho && <span className="mt-1 block italic">“{c.origem_trecho}”</span>}
          </p>
        )}
        <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2 pt-2">
          <button type="button" disabled={ocupado} onClick={aoAprovar} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            Aprovar
          </button>
          <button type="button" disabled={ocupado} onClick={aoEditar} className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium">
            Editar
          </button>
          <button type="button" disabled={ocupado} onClick={aoDescartar} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
            Descartar
          </button>
        </div>
      </div>
    </article>
  );
}
