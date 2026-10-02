"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { op } from "@/lib/painel/cliente";
import type { Conteudo, Status, TipoConteudo } from "@/lib/tipos";
import { ROTULO_STATUS } from "@/lib/regras/estados";
import {
  chaveDia, formatarHora, gradeMes, gradeSemana, horaDoSlotTexto, intervaloUtc, NOMES_DIA_CURTO, NOMES_MES,
  partesDaChave, slotJaPassou, somarDias, type ChaveDia,
} from "@/lib/regras/datas";
import { Miniatura } from "./Miniatura";
import { BadgeStatus, COR_STATUS } from "./Status";
import { DetalheConteudo } from "./DetalheConteudo";
import { IconeDireita, IconeEsquerda, IconePaginas, IconePlay } from "./Icones";
import { useToast } from "./Toasts";

type Visao = "mes" | "semana" | "lista";
const TIPOS: TipoConteudo[] = ["reel", "carrossel"];
const CONTADORES: Status[] = ["pendente", "agendado", "publicado", "erro"];

function porDia(itens: Conteudo[]): Map<ChaveDia, Conteudo[]> {
  const m = new Map<ChaveDia, Conteudo[]>();
  for (const c of itens) {
    const k = chaveDia(c.data_agendada);
    m.set(k, [...(m.get(k) ?? []), c]);
  }
  return m;
}

/** Tipos com vaga livre num dia (sem item não descartado e slot ainda por vir). */
function vagasLivres(chave: ChaveDia, doDia: Conteudo[], agora: Date): TipoConteudo[] {
  return TIPOS.filter((t) => !slotJaPassou(t, chave, agora) && !doDia.some((c) => c.tipo === t && c.status !== "descartado"));
}

export function Calendario() {
  const toast = useToast();
  const hoje = chaveDia(new Date());
  const [visao, setVisao] = useState<Visao>("mes");
  const [referencia, setReferencia] = useState<ChaveDia>(hoje);
  const [filtro, setFiltro] = useState<Status | null>(null);
  const [itens, setItens] = useState<Conteudo[]>([]);
  const [contagem, setContagem] = useState<Record<Status, number> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  const { ano, mes } = partesDaChave(referencia);
  const grade = useMemo(() => gradeMes(ano, mes), [ano, mes]);
  const semana = useMemo(() => gradeSemana(referencia), [referencia]);
  const [primeiro, ultimo] = visao === "semana" ? [semana[0], semana[6]] : [grade[0].chave, grade[grade.length - 1].chave];

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { de, ate } = intervaloUtc(primeiro, ultimo);
      const [lista, cont] = await Promise.all([op("listarConteudos", de, ate), op("contarPorStatus")]);
      setItens(lista);
      setContagem(cont);
      setAgora(new Date());
    } catch (e) {
      toast("erro", e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [primeiro, ultimo, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados ao trocar o período
    void carregar();
  }, [carregar]);

  const visiveis = filtro ? itens.filter((c) => c.status === filtro) : itens.filter((c) => c.status !== "descartado");
  const mapa = porDia(visiveis);
  const mapaTodos = porDia(itens);
  const atual = itens.find((c) => c.id === selecionado) ?? null;

  function navegar(direcao: -1 | 1) {
    if (visao === "semana") setReferencia(somarDias(referencia, 7 * direcao));
    else {
      const d = new Date(Date.UTC(ano, mes - 1 + direcao, 1));
      setReferencia(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  const titulo =
    visao === "semana"
      ? `${partesDaChave(semana[0]).dia}/${String(partesDaChave(semana[0]).mes).padStart(2, "0")} – ${partesDaChave(semana[6]).dia}/${String(partesDaChave(semana[6]).mes).padStart(2, "0")}`
      : `${NOMES_MES[mes - 1]} ${ano}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">Calendário</h1>
        <div className="flex rounded-xl bg-zinc-200/70 p-1 text-sm">
          {(["mes", "semana", "lista"] as Visao[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisao(v)}
              className={`rounded-lg px-3 py-1.5 font-medium ${visao === v ? "bg-white shadow-sm" : "text-zinc-600"}`}
            >
              {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONTADORES.map((s) => {
          const ativo = filtro === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(ativo ? null : s)}
              className={`flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-left ${ativo ? `${COR_STATUS[s].borda} ring-2 ring-offset-1 ${COR_STATUS[s].borda.replace("border", "ring")}` : "border-zinc-200"}`}
            >
              <span className="flex items-center gap-2 text-xs text-zinc-600 sm:text-sm">
                <span className={`h-2 w-2 rounded-full ${COR_STATUS[s].ponto}`} />
                {s === "erro" ? "Com erro" : `${ROTULO_STATUS[s]}s`}
              </span>
              <span className="text-lg font-bold">{contagem ? contagem[s] : "–"}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navegar(-1)} aria-label="Anterior" className="rounded-lg border border-zinc-200 bg-white p-1.5">
            <IconeEsquerda width={18} height={18} />
          </button>
          <button type="button" onClick={() => navegar(1)} aria-label="Próximo" className="rounded-lg border border-zinc-200 bg-white p-1.5">
            <IconeDireita width={18} height={18} />
          </button>
          <button type="button" onClick={() => setReferencia(hoje)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium">
            Hoje
          </button>
        </div>
        <p className="text-sm font-semibold capitalize sm:text-base">
          {titulo} {carregando && <span className="ml-1 text-xs font-normal text-zinc-400">carregando…</span>}
        </p>
      </div>
      {filtro && (
        <p className="-mt-2 text-xs text-zinc-500">
          Mostrando só “{ROTULO_STATUS[filtro].toLowerCase()}”.{" "}
          <button type="button" className="underline" onClick={() => setFiltro(null)}>
            Limpar filtro
          </button>
        </p>
      )}

      {visao === "mes" && (
        <VisaoMes grade={grade} mapa={mapa} mapaTodos={mapaTodos} hoje={hoje} agora={agora} aoAbrir={setSelecionado} mostrarVagas={!filtro} />
      )}
      {visao === "semana" && (
        <VisaoSemana dias={semana} mapa={mapa} mapaTodos={mapaTodos} hoje={hoje} agora={agora} aoAbrir={setSelecionado} mostrarVagas={!filtro} />
      )}
      {visao === "lista" && <VisaoLista itens={visiveis.filter((c) => partesDaChave(chaveDia(c.data_agendada)).mes === mes)} aoAbrir={setSelecionado} />}

      <DetalheConteudo key={atual?.id ?? "nenhum"} conteudo={atual} aoFechar={() => setSelecionado(null)} aoMudar={carregar} />
    </div>
  );
}

interface PropsVisao {
  mapa: Map<ChaveDia, Conteudo[]>;
  mapaTodos: Map<ChaveDia, Conteudo[]>;
  hoje: ChaveDia;
  agora: Date;
  aoAbrir: (id: string) => void;
  mostrarVagas: boolean;
}

function VagaLivre({ tipo, grande = false }: { tipo: TipoConteudo; grande?: boolean }) {
  return (
    <span
      title={`Vaga livre: ${tipo} às ${horaDoSlotTexto(tipo)}`}
      className={`flex items-center justify-center rounded border border-dashed border-zinc-300 text-zinc-300 ${grande ? "h-full min-h-24 w-full gap-1 text-xs" : "h-[18px] w-[18px] md:h-7 md:w-7"}`}
    >
      {tipo === "reel" ? <IconePlay width={grande ? 12 : 8} height={grande ? 12 : 8} /> : <IconePaginas width={grande ? 12 : 8} height={grande ? 12 : 8} />}
      {grande && `Livre · ${horaDoSlotTexto(tipo)}`}
    </span>
  );
}

function VisaoMes({ grade, mapa, mapaTodos, hoje, agora, aoAbrir, mostrarVagas }: PropsVisao & { grade: ReturnType<typeof gradeMes> }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-[11px] font-medium text-zinc-500">
        {NOMES_DIA_CURTO.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grade.map((d) => {
          const doDia = mapa.get(d.chave) ?? [];
          const vagas = mostrarVagas && d.doMes ? vagasLivres(d.chave, mapaTodos.get(d.chave) ?? [], agora) : [];
          return (
            <div key={d.chave} className={`min-h-[72px] min-w-0 border-b border-r border-zinc-100 p-1 md:min-h-[112px] md:p-1.5 ${d.doMes ? "" : "bg-zinc-50/70"}`}>
              <span
                className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] md:h-6 md:w-6 md:text-xs ${
                  d.chave === hoje ? "bg-zinc-900 font-bold text-white" : d.doMes ? "text-zinc-700" : "text-zinc-300"
                }`}
              >
                {d.dia}
              </span>
              <div className="flex flex-wrap gap-0.5 md:gap-1">
                {doDia.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => aoAbrir(c.id)}
                    title={`${c.tipo === "reel" ? "Reel" : "Carrossel"} ${formatarHora(c.data_agendada)} · ${ROTULO_STATUS[c.status]}`}
                    className={`rounded border-2 ${COR_STATUS[c.status].borda} ${c.status === "descartado" ? "opacity-50" : ""}`}
                  >
                    <Miniatura conteudo={c} comSelo={false} className="h-[18px] w-[18px] rounded-sm md:hidden" />
                    <Miniatura conteudo={c} className="hidden h-10 w-10 rounded-sm md:block" />
                  </button>
                ))}
                {vagas.map((t) => (
                  <VagaLivre key={t} tipo={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardSemana({ c, aoAbrir }: { c: Conteudo; aoAbrir: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(c.id)}
      className={`flex w-full min-w-0 flex-col overflow-hidden rounded-xl border-l-4 bg-white text-left shadow-sm ring-1 ring-zinc-200 ${COR_STATUS[c.status].borda} ${c.status === "descartado" ? "opacity-50" : ""}`}
    >
      <Miniatura conteudo={c} className="aspect-square w-full" />
      <div className="flex flex-col gap-1 p-1.5">
        <span className="text-xs font-semibold">{formatarHora(c.data_agendada)}</span>
        <BadgeStatus status={c.status} />
      </div>
    </button>
  );
}

function VisaoSemana({ dias, mapa, mapaTodos, hoje, agora, aoAbrir, mostrarVagas }: PropsVisao & { dias: ChaveDia[] }) {
  const celula = (chave: ChaveDia, tipo: TipoConteudo) => {
    const doTipo = (mapa.get(chave) ?? []).filter((c) => c.tipo === tipo);
    const livre = mostrarVagas && vagasLivres(chave, mapaTodos.get(chave) ?? [], agora).includes(tipo);
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        {doTipo.map((c) => (
          <CardSemana key={c.id} c={c} aoAbrir={aoAbrir} />
        ))}
        {!doTipo.length && livre && <VagaLivre tipo={tipo} grande />}
      </div>
    );
  };
  const rotuloDia = (chave: ChaveDia) => {
    const p = partesDaChave(chave);
    return `${NOMES_DIA_CURTO[new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay()]} ${p.dia}/${String(p.mes).padStart(2, "0")}`;
  };

  return (
    <>
      {/* Desktop: 7 colunas × 2 linhas (reel / carrossel) */}
      <div className="hidden grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2 md:grid">
        <div />
        {dias.map((d) => (
          <div key={d} className={`rounded-lg py-1 text-center text-xs font-semibold ${d === hoje ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>
            {rotuloDia(d)}
          </div>
        ))}
        {TIPOS.map((t) => (
          <div key={t} className="contents">
            <div className="pt-2 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-700">{horaDoSlotTexto(t)}</p>
              {t === "reel" ? "Reel" : "Carrossel"}
            </div>
            {dias.map((d) => (
              <div key={d + t}>{celula(d, t)}</div>
            ))}
          </div>
        ))}
      </div>
      {/* Celular: um dia por linha, reel e carrossel lado a lado */}
      <div className="flex flex-col gap-3 md:hidden">
        {dias.map((d) => (
          <div key={d} className="rounded-2xl border border-zinc-200 bg-white p-3">
            <p className={`mb-2 text-sm font-semibold ${d === hoje ? "text-pink-600" : ""}`}>
              {rotuloDia(d)} {d === hoje && "· hoje"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <div key={t} className="min-w-0">
                  <p className="mb-1 text-[11px] text-zinc-500">
                    {horaDoSlotTexto(t)} · {t === "reel" ? "Reel" : "Carrossel"}
                  </p>
                  {celula(d, t)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function VisaoLista({ itens, aoAbrir }: { itens: Conteudo[]; aoAbrir: (id: string) => void }) {
  const grupos = [...porDia(itens).entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!grupos.length) return <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">Nenhum conteúdo neste mês.</p>;
  return (
    <div className="flex flex-col gap-4">
      {grupos.map(([dia, lista]) => {
        const p = partesDaChave(dia);
        return (
          <section key={dia}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-600">
              {NOMES_DIA_CURTO[new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay()]}, {String(p.dia).padStart(2, "0")}/{String(p.mes).padStart(2, "0")}/{p.ano}
            </h2>
            <div className="flex flex-col gap-2">
              {lista.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => aoAbrir(c.id)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2 text-left"
                >
                  <Miniatura conteudo={c} className="h-16 w-16 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{formatarHora(c.data_agendada)}</span>
                      <span className="text-xs text-zinc-500">{c.tipo === "reel" ? "Reel" : `Carrossel · ${c.midia_urls.length}`}</span>
                      <BadgeStatus status={c.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 break-words text-sm text-zinc-600">{c.descricao || <em className="text-zinc-400">sem descrição</em>}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
