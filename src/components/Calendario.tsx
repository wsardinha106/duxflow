"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { op } from "@/lib/painel/cliente";
import type { StatusConexao } from "@/lib/painel/ops";
import type { Conteudo, Status, TipoConteudo } from "@/lib/tipos";
import { ROTULO_STATUS } from "@/lib/regras/estados";
import {
  chaveDia, formatarDiaMes, formatarHora, gradeMes, gradeSemana, horaDoSlotTexto, intervaloUtc, NOMES_DIA_CURTO,
  NOMES_DIA_GRADE, NOMES_MES, partesDaChave, slotJaPassou, somarDias, type ChaveDia,
} from "@/lib/regras/datas";
import { Miniatura } from "./Miniatura";
import { COR_STATUS, SeloStatus } from "./Status";
import { DetalheConteudo } from "./DetalheConteudo";
import { IconeDireita, IconeEsquerda, IconePaginas, IconePlay } from "./Icones";
import { useAcoes } from "./useAcoes";
import { useToast } from "./Toasts";

type Visao = "mes" | "semana" | "lista";
type Aba = "pendente" | "agendado" | "publicado" | "erro";
const TIPOS: TipoConteudo[] = ["reel", "carrossel"];
const CONTADORES: { status: Aba; rotulo: string }[] = [
  { status: "pendente", rotulo: "Pendentes" },
  { status: "agendado", rotulo: "Agendados" },
  { status: "publicado", rotulo: "Publicados" },
  { status: "erro", rotulo: "Erros" },
];
const LEGENDA: Status[] = ["pendente", "agendado", "publicado", "erro", "descartado"];
const ROTULO_TIPO: Record<TipoConteudo, string> = { reel: "Reel", carrossel: "Carrossel" };

/** "Publicando" anda junto com "agendado" nos filtros e contadores. */
const grupo = (s: Status): Status => (s === "publicando" ? "agendado" : s);

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
  const [ocultos, setOcultos] = useState<Set<Status>>(() => new Set<Status>(["descartado"]));
  const [aba, setAba] = useState<Aba>("pendente");
  const [itens, setItens] = useState<Conteudo[]>([]);
  const [itensAba, setItensAba] = useState<Conteudo[] | null>(null);
  const [contagem, setContagem] = useState<Record<Status, number> | null>(null);
  const [conexao, setConexao] = useState<StatusConexao | null | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  const { ano, mes } = partesDaChave(referencia);
  const grade = useMemo(() => gradeMes(ano, mes), [ano, mes]);
  const semana = useMemo(() => gradeSemana(referencia), [referencia]);
  const [primeiro, ultimo] = visao === "semana" ? [semana[0], semana[6]] : [grade[0].chave, grade[grade.length - 1].chave];
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const acoes = useAcoes(recarregar);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados ao trocar o período
    setCarregando(true);
    const { de, ate } = intervaloUtc(primeiro, ultimo);
    Promise.all([op("listarConteudos", de, ate), op("contarPorStatus")])
      .then(([lista, cont]) => {
        if (!vivo) return;
        setItens(lista);
        setContagem(cont);
        setAgora(new Date());
      })
      .catch((e) => vivo && toast("erro", e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [primeiro, ultimo, versao, toast]);

  useEffect(() => {
    if (visao !== "lista") return;
    let vivo = true;
    op("listarPorStatus", aba)
      .then((lista) => vivo && setItensAba(lista))
      .catch((e) => {
        if (!vivo) return;
        toast("erro", e instanceof Error ? e.message : String(e));
        setItensAba([]);
      });
    return () => {
      vivo = false;
    };
  }, [visao, aba, versao, toast]);

  useEffect(() => {
    op("statusConexao")
      .then(setConexao)
      .catch(() => setConexao(null));
  }, []);

  const visiveis = itens.filter((c) => !ocultos.has(grupo(c.status)));
  const mapa = porDia(visiveis);
  const mapaTodos = porDia(itens);
  const mostrarVagas = !ocultos.has("pendente") && !ocultos.has("agendado");
  const atual = itens.find((c) => c.id === selecionado) ?? itensAba?.find((c) => c.id === selecionado) ?? null;
  const qtdPosts =
    visao === "semana"
      ? visiveis.length
      : visiveis.filter((c) => partesDaChave(chaveDia(c.data_agendada)).mes === mes).length;

  function navegar(direcao: -1 | 1) {
    if (visao === "semana") setReferencia(somarDias(referencia, 7 * direcao));
    else {
      const d = new Date(Date.UTC(ano, mes - 1 + direcao, 1));
      setReferencia(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  function alternar(s: Status) {
    setOcultos((atuais) => {
      const novo = new Set(atuais);
      if (novo.has(s)) novo.delete(s);
      else novo.add(s);
      return novo;
    });
  }

  const diaMes = (chave: ChaveDia) => {
    const p = partesDaChave(chave);
    return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
  };
  const titulo = visao === "semana" ? `${diaMes(semana[0])} – ${diaMes(semana[6])}` : `${NOMES_MES[mes - 1]} ${ano}`;
  const total = (s: Aba) => (contagem ? contagem[s] + (s === "agendado" ? contagem.publicando : 0) : null);
  const pendentes = total("pendente") ?? 0;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Cabecalho hoje={hoje} conexao={conexao} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {CONTADORES.map(({ status, rotulo }) => (
          <div key={status} className="flex items-center gap-4 rounded-3xl border border-zinc-200/80 bg-white px-5 py-5 shadow-sm md:px-6">
            <span className={`h-12 w-1.5 shrink-0 rounded-full ${COR_STATUS[status].ponto}`} />
            <div className="min-w-0">
              <p className="text-3xl font-extrabold leading-none tracking-tight md:text-4xl">{total(status) ?? "–"}</p>
              <p className="mt-1.5 truncate text-sm text-zinc-500 md:text-base">{rotulo}</p>
            </div>
          </div>
        ))}
      </div>

      {visao === "lista" ? (
        <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Todos os conteúdos</h2>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <BotaoRedondo aoClicar={() => navegar(-1)} rotulo="Anterior">
            <IconeEsquerda width={20} height={20} />
          </BotaoRedondo>
          <BotaoRedondo aoClicar={() => navegar(1)} rotulo="Próximo">
            <IconeDireita width={20} height={20} />
          </BotaoRedondo>
          <p className="text-2xl font-extrabold capitalize tracking-tight md:text-3xl">{titulo}</p>
          <span className="text-base text-zinc-400">{carregando ? "carregando…" : `${qtdPosts} posts`}</span>
          <button
            type="button"
            onClick={() => setReferencia(hoje)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
          >
            Hoje
          </button>
        </div>
      )}

      <div className="flex w-fit rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
        {(["mes", "semana", "lista"] as Visao[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisao(v)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors md:text-base ${visao === v ? "bg-zinc-900 text-white" : "text-zinc-700 hover:text-zinc-900"}`}
          >
            {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Lista"}
          </button>
        ))}
      </div>

      {visao !== "lista" && (
        <div className="flex flex-wrap gap-2">
          {LEGENDA.map((s) => {
            const oculto = ocultos.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => alternar(s)}
                aria-pressed={!oculto}
                className={`flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium ${oculto ? "text-zinc-400 line-through" : "text-zinc-800"}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${oculto ? "bg-zinc-200" : COR_STATUS[s].ponto}`} />
                {s === "erro" ? "Erro" : ROTULO_STATUS[s]}
              </button>
            );
          })}
        </div>
      )}

      {visao === "mes" && (
        <VisaoMes grade={grade} mapa={mapa} mapaTodos={mapaTodos} hoje={hoje} agora={agora} aoAbrir={setSelecionado} mostrarVagas={mostrarVagas} />
      )}
      {visao === "semana" && (
        <VisaoSemana dias={semana} mapa={mapa} mapaTodos={mapaTodos} hoje={hoje} agora={agora} aoAbrir={setSelecionado} mostrarVagas={mostrarVagas} />
      )}
      {visao === "lista" && (
        <div className="flex flex-col gap-4">
          <div className="sem-barra -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex w-max gap-1 rounded-full bg-zinc-200/60 p-1">
              {CONTADORES.filter(({ status }) => status !== "erro" || aba === "erro" || (total("erro") ?? 0) > 0).map(({ status, rotulo }) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    if (status === aba) return;
                    setItensAba(null);
                    setAba(status);
                  }}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium transition-colors ${aba === status ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                >
                  {rotulo}
                  <span className="rounded-full bg-zinc-200/80 px-2 text-sm text-zinc-700">{total(status) ?? "–"}</span>
                </button>
              ))}
            </div>
          </div>

          {aba === "pendente" && pendentes > 0 && (
            <button
              type="button"
              disabled={!!acoes.ocupado}
              onClick={() => window.confirm(`Aprovar todos os ${pendentes} pendentes?`) && acoes.aprovarTodos()}
              className="w-full rounded-2xl bg-zinc-900 px-4 py-4 text-base font-semibold text-white shadow-sm disabled:opacity-50 md:w-auto md:self-start md:px-8"
            >
              {acoes.ocupado === "aprovarTodos" ? "Aprovando…" : `Aprovar todos os ${pendentes} pendentes`}
            </button>
          )}

          <VisaoLista itens={itensAba} aba={aba} aoAbrir={setSelecionado} />
        </div>
      )}

      <DetalheConteudo key={atual?.id ?? "nenhum"} conteudo={atual} aoFechar={() => setSelecionado(null)} aoMudar={recarregar} />
    </div>
  );
}

function Cabecalho({ hoje, conexao }: { hoje: ChaveDia; conexao: StatusConexao | null | undefined }) {
  const p = partesDaChave(hoje);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/25 md:h-16 md:w-16">
          <span className="text-[10px] font-bold uppercase leading-none tracking-wider opacity-90">{NOMES_MES[p.mes - 1].slice(0, 3)}</span>
          <span className="text-2xl font-extrabold leading-none md:text-[28px]">{p.dia}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">Calendário de conteúdo</h1>
          <p className="text-sm text-zinc-500 md:text-base">
            Reel às {horaDoSlotTexto("reel")} · carrossel às {horaDoSlotTexto("carrossel")} · horário de Brasília
          </p>
        </div>
      </div>
      {conexao === undefined ? (
        <span className="h-10 w-48 animate-pulse rounded-full bg-zinc-200/70" />
      ) : conexao?.conectado ? (
        <Link
          href="/conexoes"
          className="flex w-fit items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-base font-medium text-emerald-800"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />@{conexao.username}
        </Link>
      ) : (
        <Link href="/conexoes" className="flex w-fit items-center gap-2.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-base font-medium text-red-700">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Instagram desconectado
        </Link>
      )}
    </div>
  );
}

function BotaoRedondo({ aoClicar, rotulo, children }: { aoClicar: () => void; rotulo: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 md:h-12 md:w-12"
    >
      {children}
    </button>
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

function IconeTipo({ tipo, tamanho }: { tipo: TipoConteudo; tamanho: number }) {
  return tipo === "reel" ? <IconePlay width={tamanho} height={tamanho} /> : <IconePaginas width={tamanho} height={tamanho} />;
}

function VagaLivre({ tipo, grande = false }: { tipo: TipoConteudo; grande?: boolean }) {
  return (
    <span
      title={`Vaga livre: ${ROTULO_TIPO[tipo].toLowerCase()} às ${horaDoSlotTexto(tipo)}`}
      className={`flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-300 ${
        grande ? "aspect-[4/5] w-full flex-col gap-1 text-xs font-medium" : "aspect-square w-full md:h-10 md:w-10"
      }`}
    >
      <IconeTipo tipo={tipo} tamanho={grande ? 16 : 10} />
      {grande && (
        <>
          <span>Livre</span>
          <span>{horaDoSlotTexto(tipo)}</span>
        </>
      )}
    </span>
  );
}

/** Círculo do número do dia (hoje em degradê). */
function NumeroDia({ dia, hoje, apagado = false, grande = false }: { dia: number; hoje: boolean; apagado?: boolean; grande?: boolean }) {
  const tamanho = grande ? "h-11 w-11 text-2xl" : "h-7 w-7 text-sm md:h-8 md:w-8 md:text-base";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${tamanho} ${
        hoje ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-md shadow-fuchsia-500/30" : apagado ? "text-zinc-300" : "text-zinc-800"
      }`}
    >
      {dia}
    </span>
  );
}

function VisaoMes({ grade, mapa, mapaTodos, hoje, agora, aoAbrir, mostrarVagas }: PropsVisao & { grade: ReturnType<typeof gradeMes> }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-zinc-100 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 md:text-sm">
        {NOMES_DIA_GRADE.map((d) => (
          <div key={d} className="py-3 md:py-4">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-100">
        {grade.map((d) => {
          const doDia = mapa.get(d.chave) ?? [];
          const vagas = mostrarVagas && d.doMes ? vagasLivres(d.chave, mapaTodos.get(d.chave) ?? [], agora) : [];
          return (
            <div key={d.chave} className={`flex min-h-[104px] min-w-0 flex-col gap-1 bg-white p-1 md:min-h-[136px] md:gap-1.5 md:p-2 ${d.doMes ? "" : "bg-zinc-50/60"}`}>
              <div className="px-0.5 md:px-1">
                <NumeroDia dia={d.dia} hoje={d.chave === hoje} apagado={!d.doMes} />
              </div>
              {doDia.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => aoAbrir(c.id)}
                  title={`${ROTULO_TIPO[c.tipo]} ${formatarHora(c.data_agendada)} · ${ROTULO_STATUS[c.status]}`}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-lg border-l-[3px] p-0.5 pl-1 transition hover:brightness-95 md:rounded-xl md:p-1 md:pl-1.5 ${COR_STATUS[c.status].borda} ${COR_STATUS[c.status].fundo} ${c.status === "descartado" ? "opacity-50" : ""}`}
                >
                  <Miniatura conteudo={c} comSelo={false} className="aspect-square w-full rounded-md md:h-10 md:w-10 md:shrink-0 md:rounded-lg" />
                  <span className="hidden min-w-0 text-left leading-tight md:block">
                    <span className="block text-xs font-bold text-zinc-800">{formatarHora(c.data_agendada)}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{ROTULO_TIPO[c.tipo]}</span>
                  </span>
                </button>
              ))}
              {vagas.map((t) => (
                <VagaLivre key={t} tipo={t} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Card com a miniatura alta, tipo e status por cima, e um rodapé livre. */
function CardConteudo({ c, aoAbrir, comTipo = true, children }: { c: Conteudo; aoAbrir: (id: string) => void; comTipo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(c.id)}
      className={`flex w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md md:rounded-3xl ${c.status === "descartado" ? "opacity-50" : ""}`}
    >
      <div className="relative w-full">
        <Miniatura conteudo={c} comSelo={false} className="aspect-[4/5] w-full" />
        {comTipo && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold leading-4 text-white backdrop-blur-sm md:text-xs">
            <IconeTipo tipo={c.tipo} tamanho={10} />
            {c.tipo === "reel" ? "Reel" : `${c.midia_urls.length} fotos`}
          </span>
        )}
        <SeloStatus status={c.status} className="absolute right-2 top-2" />
      </div>
      <span className={`h-1 w-full ${COR_STATUS[c.status].ponto}`} />
      {children}
    </button>
  );
}

function VisaoSemana({ dias, mapa, mapaTodos, hoje, agora, aoAbrir, mostrarVagas }: PropsVisao & { dias: ChaveDia[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="sem-barra flex snap-x snap-mandatory overflow-x-auto md:grid md:snap-none md:grid-cols-7 md:overflow-visible">
        {dias.map((d) => {
          const p = partesDaChave(d);
          const doDia = mapa.get(d) ?? [];
          const vagas = mostrarVagas ? vagasLivres(d, mapaTodos.get(d) ?? [], agora) : [];
          return (
            <div key={d} className="w-[42%] shrink-0 snap-start border-r border-zinc-100 last:border-r-0 sm:w-[28%] md:w-auto md:min-w-0">
              <div className="flex flex-col items-center gap-1 py-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 md:text-sm">
                  {NOMES_DIA_CURTO[new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay()]}
                </span>
                <NumeroDia dia={p.dia} hoje={d === hoje} grande />
              </div>
              <div className="flex flex-col gap-3 px-2 pb-4 md:px-2.5">
                {doDia.map((c) => (
                  <CardConteudo key={c.id} c={c} aoAbrir={aoAbrir} comTipo={false}>
                    <span className="flex items-baseline justify-between gap-1 px-3 py-2.5">
                      <span className="text-base font-bold md:text-lg">{formatarHora(c.data_agendada)}</span>
                      <span className="truncate text-sm text-zinc-500">{ROTULO_TIPO[c.tipo]}</span>
                    </span>
                  </CardConteudo>
                ))}
                {vagas.map((t) => (
                  <VagaLivre key={t} tipo={t} grande />
                ))}
                {!doDia.length && !vagas.length && <p className="py-6 text-center text-xs text-zinc-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VAZIO_ABA: Record<Aba, string> = {
  pendente: "Nenhum conteúdo esperando aprovação. 🎉",
  agendado: "Nada agendado no momento.",
  publicado: "Nada publicado ainda.",
  erro: "Nenhum conteúdo com erro.",
};

function VisaoLista({ itens, aba, aoAbrir }: { itens: Conteudo[] | null; aba: Aba; aoAbrir: (id: string) => void }) {
  if (!itens) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[4/6] animate-pulse rounded-2xl bg-zinc-200/70" />
        ))}
      </div>
    );
  }
  if (!itens.length) {
    return <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{VAZIO_ABA[aba]}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {itens.map((c) => (
        <CardConteudo key={c.id} c={c} aoAbrir={aoAbrir}>
          <span className="flex flex-col gap-1 p-3 md:p-4">
            <span className="text-base font-bold md:text-lg">
              {formatarDiaMes(c.data_agendada)} · {formatarHora(c.data_agendada)}
            </span>
            <span className="line-clamp-2 break-words text-sm text-zinc-500 md:text-base">
              {c.descricao || <em className="text-zinc-400">sem descrição</em>}
            </span>
          </span>
        </CardConteudo>
      ))}
    </div>
  );
}
