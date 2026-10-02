"use client";
import { useState } from "react";
import type { Conteudo } from "@/lib/tipos";
import { CORTE_MAIS, LIMITE_HASHTAGS, LIMITE_LEGENDA, montarLegenda, normalizarHashtags } from "@/lib/regras/legenda";
import { paraInputLocal } from "@/lib/regras/datas";
import type { CamposEdicao } from "@/lib/painel/ops";

export function FormEdicao({
  conteudo,
  salvando,
  aoSalvar,
  aoCancelar,
}: {
  conteudo: Conteudo;
  salvando: boolean;
  aoSalvar: (campos: CamposEdicao) => void;
  aoCancelar: () => void;
}) {
  const [descricao, setDescricao] = useState(conteudo.descricao);
  const [hashtags, setHashtags] = useState(conteudo.hashtags.map((h) => `#${h}`).join(" "));
  const [alt, setAlt] = useState(conteudo.alt_text ?? "");
  const [palavra, setPalavra] = useState(conteudo.palavra_chave ?? "");
  const [data, setData] = useState(paraInputLocal(conteudo.data_agendada));

  const tags = normalizarHashtags(hashtags);
  const legenda = montarLegenda(descricao, tags);
  const tamanho = Array.from(descricao).length;
  const campo = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar({ descricao, hashtags: tags, alt_text: alt, palavra_chave: palavra, data_local: data });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Descrição</span>
        <div className="relative">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={8} className={`${campo} resize-y`} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
          <span>
            {tamanho <= CORTE_MAIS ? (
              <>Tudo aparece antes do “mais” ({tamanho}/{CORTE_MAIS})</>
            ) : (
              <>Os primeiros {CORTE_MAIS} caracteres aparecem antes do “mais”</>
            )}
          </span>
          <span className={legenda.length >= LIMITE_LEGENDA ? "font-semibold text-red-600" : ""}>
            Legenda final: {legenda.length}/{LIMITE_LEGENDA}
          </span>
        </div>
        {tamanho > CORTE_MAIS && (
          <p className="rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
            <span className="font-medium text-zinc-900">{Array.from(descricao).slice(0, CORTE_MAIS).join("")}</span>
            <span className="text-zinc-400"> | … mais</span>
          </p>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">
          Hashtags ({tags.length}/{LIMITE_HASHTAGS})
        </span>
        <textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} rows={2} className={campo} placeholder="#marketing #dicas" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Texto alternativo (acessibilidade)</span>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} className={campo} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Palavra-chave</span>
        <input value={palavra} onChange={(e) => setPalavra(e.target.value)} className={campo} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Data e hora (horário de Brasília)</span>
        <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} className={campo} required />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={aoCancelar} className="rounded-xl border border-zinc-300 px-4 py-3 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
