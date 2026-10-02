"use client";
import { useEffect, useState } from "react";
import { CLIENTE } from "@/config/cliente";
import type { Conteudo } from "@/lib/tipos";
import { acoesPermitidas, ROTULO_ACAO, type Acao } from "@/lib/regras/estados";
import { montarLegenda } from "@/lib/regras/legenda";
import { erroEmLinguagemHumana, MAX_TENTATIVAS } from "@/lib/regras/publicacao";
import { formatarDataHora } from "@/lib/regras/datas";
import { Portal } from "./Portal";
import { PreviaInstagram } from "./Previa";
import { BadgeStatus } from "./Status";
import { FormEdicao } from "./FormEdicao";
import { ConfirmarDescarte } from "./ConfirmarDescarte";
import { useAcoes } from "./useAcoes";
import { IconeFechar, IconeLink } from "./Icones";

const ORDEM_BOTOES: Acao[] = ["aprovar", "tentar_de_novo", "publicar_agora", "editar", "voltar_pendente", "descartar"];

/** Painel de detalhe: lateral no desktop, tela cheia no celular. */
export function DetalheConteudo({
  conteudo,
  aoFechar,
  aoMudar,
  editarAoAbrir = false,
}: {
  conteudo: Conteudo | null;
  aoFechar: () => void;
  aoMudar: () => void;
  editarAoAbrir?: boolean;
}) {
  const [editando, setEditando] = useState(editarAoAbrir);
  const [descartando, setDescartando] = useState<Conteudo | null>(null);
  const acoes = useAcoes(aoMudar);

  useEffect(() => {
    if (!conteudo) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && !descartando && aoFechar();
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [conteudo, aoFechar, descartando]);

  if (!conteudo) return null;
  const c = conteudo;
  const legenda = montarLegenda(c.descricao, c.hashtags);
  const erroHumano = erroEmLinguagemHumana(c.erro);
  const permitidas = acoesPermitidas(c.status);

  function clicar(acao: Acao) {
    switch (acao) {
      case "aprovar":
        return acoes.aprovar(c);
      case "tentar_de_novo":
        return acoes.tentarDeNovo(c);
      case "publicar_agora":
        if (window.confirm("Publicar agora no Instagram?")) return acoes.publicarAgora(c);
        return;
      case "editar":
        return setEditando(true);
      case "voltar_pendente":
        return acoes.voltarParaPendente(c);
      case "descartar":
        return setDescartando(c);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={aoFechar}>
        <aside
          className="anim-painel flex h-full w-full flex-col bg-white shadow-2xl md:max-w-xl"
          onClick={(e) => e.stopPropagation()}
          aria-label="Detalhe do conteúdo"
        >
          <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{c.tipo === "reel" ? "Reel" : `Carrossel · ${c.midia_urls.length} imagens`}</span>
                <BadgeStatus status={c.status} />
              </div>
              <p className="text-xs text-zinc-500">{formatarDataHora(c.data_agendada)} (Brasília)</p>
            </div>
            <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-full p-2 hover:bg-zinc-100">
              <IconeFechar />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            {editando ? (
              <FormEdicao
                conteudo={c}
                salvando={acoes.ocupado === "editar"}
                aoCancelar={() => setEditando(false)}
                aoSalvar={async (campos) => {
                  const r = await acoes.editar(c, campos);
                  if (r) setEditando(false);
                }}
              />
            ) : (
              <div className="flex flex-col gap-6">
                <PreviaInstagram conteudo={c} usuario={CLIENTE.instagram} legenda={legenda} />

                {erroHumano && c.status !== "publicado" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold">
                      {c.status === "erro" ? "Não foi possível publicar" : "A última tentativa falhou"} ({c.tentativas}/{MAX_TENTATIVAS} tentativas)
                    </p>
                    <p className="mt-1">{erroHumano}</p>
                    {erroHumano !== c.erro && <p className="mt-2 break-words text-xs text-red-600/80">Detalhe técnico: {c.erro}</p>}
                  </div>
                )}

                {c.status === "publicado" && c.ig_permalink && (
                  <a href={c.ig_permalink} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
                    <IconeLink width={16} height={16} /> Ver no Instagram
                  </a>
                )}

                <section>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Legenda como vai sair</h3>
                  <pre className="whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-3 font-sans text-sm">
                    {Array.from(legenda).slice(0, 125).join("")}
                    {Array.from(legenda).length > 125 && (
                      <>
                        <span className="mx-0.5 rounded bg-pink-100 px-1 text-[10px] font-semibold text-pink-700" title="Até aqui aparece antes do “mais”">
                          mais
                        </span>
                        <span className="text-zinc-600">{Array.from(legenda).slice(125).join("")}</span>
                      </>
                    )}
                  </pre>
                  <p className="mt-1 text-right text-xs text-zinc-400">{legenda.length}/2200</p>
                </section>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {c.tema && (<><dt className="text-zinc-500">Tema</dt><dd>{c.tema}</dd></>)}
                  {c.nota !== null && (<><dt className="text-zinc-500">Nota</dt><dd>{c.nota}/10</dd></>)}
                  {c.palavra_chave && (<><dt className="text-zinc-500">Palavra-chave</dt><dd>{c.palavra_chave}</dd></>)}
                  {c.alt_text && (<><dt className="text-zinc-500">Texto alt.</dt><dd className="break-words">{c.alt_text}</dd></>)}
                  {c.origem_url && (
                    <>
                      <dt className="text-zinc-500">Origem</dt>
                      <dd className="min-w-0">
                        <a href={c.origem_url} target="_blank" rel="noreferrer" className="break-all text-sky-700 underline">{c.origem_url}</a>
                        {c.origem_trecho && <p className="mt-1 text-xs italic text-zinc-500">“{c.origem_trecho}”</p>}
                      </dd>
                    </>
                  )}
                  <dt className="text-zinc-500">Criado</dt><dd>{formatarDataHora(c.created_at)}</dd>
                  {c.aprovado_em && (<><dt className="text-zinc-500">Aprovado</dt><dd>{formatarDataHora(c.aprovado_em)}</dd></>)}
                  {c.publicado_em && (<><dt className="text-zinc-500">Publicado</dt><dd>{formatarDataHora(c.publicado_em)}</dd></>)}
                </dl>
              </div>
            )}
          </div>

          {!editando && permitidas.length > 0 && (
            <footer className="grid grid-cols-2 gap-2 border-t border-zinc-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {ORDEM_BOTOES.filter((a) => permitidas.includes(a)).map((a) => {
                const destaque = a === "aprovar" || a === "tentar_de_novo";
                const perigo = a === "descartar";
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={!!acoes.ocupado}
                    onClick={() => clicar(a)}
                    className={`rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50 ${
                      destaque ? "col-span-2 bg-zinc-900 text-white" : perigo ? "border border-red-200 text-red-700" : "border border-zinc-300"
                    }`}
                  >
                    {acoes.ocupado === a ? "Aguarde…" : ROTULO_ACAO[a]}
                  </button>
                );
              })}
            </footer>
          )}
        </aside>
      </div>
      <ConfirmarDescarte
        conteudo={descartando}
        aoFechar={() => setDescartando(null)}
        aoConfirmar={async (puxar) => {
          const alvo = descartando!;
          setDescartando(null);
          await acoes.descartar(alvo, puxar);
        }}
      />
    </Portal>
  );
}
