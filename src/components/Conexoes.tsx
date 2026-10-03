"use client";
import { useCallback, useEffect, useState } from "react";
import { op } from "@/lib/painel/cliente";
import type { StatusConexao } from "@/lib/painel/ops";
import { formatarData, formatarDiaMes, formatarHora } from "@/lib/regras/datas";
import { useToast } from "./Toasts";

const numero = (n: number | null) => (n === null ? "–" : n.toLocaleString("pt-BR"));

export function Conexoes() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusConexao | null>(null);
  const [token, setToken] = useState("");
  const [trocando, setTrocando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const executar = useCallback(
    async (chave: string, fn: () => Promise<StatusConexao>, sucesso?: string) => {
      setOcupado(chave);
      try {
        const s = await fn();
        setStatus(s);
        if (sucesso && s.conectado) toast("sucesso", sucesso);
        else if (sucesso && s.problema) toast("erro", s.problema);
        return s;
      } catch (e) {
        toast("erro", e instanceof Error ? e.message : String(e));
      } finally {
        setOcupado(null);
      }
    },
    [toast],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial
    void executar("carregar", () => op("statusConexao"));
  }, [executar]);

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    const s = await executar("conectar", () => op("conectar", token), "Instagram conectado!");
    if (s?.conectado) {
      setToken("");
      setTrocando(false);
    }
  }

  const mostrarFormulario = status && (!status.conectado || trocando);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Conexões</h1>
        <p className="text-sm text-zinc-500">Conta do Instagram onde os conteúdos são publicados.</p>
      </div>

      {!status && <div className="h-40 animate-pulse rounded-2xl bg-zinc-200/70" />}

      {status?.conectado && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-4">
            {status.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={status.foto} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-pink-500 ring-offset-2" />
            ) : (
              <span className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600" />
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">@{status.username}</p>
              {status.nome && <p className="truncate text-sm text-zinc-600">{status.nome}</p>}
              <p className="mt-1 text-sm text-zinc-600">
                <b>{numero(status.seguidores)}</b> seguidores · <b>{numero(status.posts)}</b> posts
              </p>
            </div>
            <span className="ml-auto hidden rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 sm:inline">Conectado</span>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-1 text-sm text-zinc-600 sm:grid-cols-2">
            <div>
              Token renovado em <b>{status.renovadoEm ? `${formatarDiaMes(status.renovadoEm)} ${formatarHora(status.renovadoEm)}` : "–"}</b>
            </div>
            {status.expiraEm && (
              <div>
                Vale até <b>{formatarDiaMes(status.expiraEm)}</b>
                <span className="text-zinc-400"> ({formatarData(status.expiraEm)})</span>
              </div>
            )}
          </dl>
          <p className="mt-1 text-xs text-zinc-400">O token é renovado sozinho a cada 24 horas.</p>
          {status.erroRenovacao && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              A última renovação automática falhou (o token atual continua valendo até vencer): {status.erroRenovacao}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!!ocupado} onClick={() => executar("testar", () => op("testarConexao"), "Conexão funcionando.")} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
              {ocupado === "testar" ? "Testando…" : "Testar conexão"}
            </button>
            <button type="button" disabled={!!ocupado} onClick={() => setTrocando((v) => !v)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
              Trocar token
            </button>
            <button
              type="button"
              disabled={!!ocupado}
              onClick={() => window.confirm("Desconectar o Instagram? Nada será publicado até conectar de novo.") && executar("desconectar", () => op("desconectar"))}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Desconectar
            </button>
          </div>
        </section>
      )}

      {status && !status.conectado && status.problema && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Instagram não conectado</p>
          <p className="mt-1">{status.problema}</p>
          {status.username && <p className="mt-1 text-xs">Última conta conectada: @{status.username}</p>}
        </div>
      )}

      {mostrarFormulario && (
        <form onSubmit={conectar} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{status?.conectado ? "Novo token" : "Cole o token do Instagram"}</span>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder="IGAA…"
              className="w-full break-all rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900"
            />
          </label>
          <button type="submit" disabled={!token.trim() || !!ocupado} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {ocupado === "conectar" ? "Validando…" : "Conectar"}
          </button>
          <p className="text-xs text-zinc-500">O token fica guardado só no servidor e nunca é mostrado de novo.</p>
        </form>
      )}

      <details className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm" open={status ? !status.conectado : false}>
        <summary className="cursor-pointer font-semibold">Como gerar o token (passo a passo)</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-700">
          <li>Tenha uma conta do Instagram <b>Profissional</b> (Empresa ou Criador de conteúdo).</li>
          <li>
            Em <b>developers.facebook.com</b> → <b>Meus apps → Criar app</b>, escolha o caso de uso <b>“Gerenciar mensagens e conteúdo no Instagram”</b> (API do Instagram com login do Instagram).
          </li>
          <li>
            Em <b>API do Instagram → Configuração da API com login do Instagram</b>, adicione a conta do Instagram e clique em <b>Gerar token</b>.
          </li>
          <li>
            Permissões necessárias: <code className="rounded bg-zinc-100 px-1">instagram_business_basic</code> e{" "}
            <code className="rounded bg-zinc-100 px-1">instagram_business_content_publish</code>.
          </li>
          <li>Copie o token e cole aqui, em <b>Conexões</b>.</li>
          <li>
            Enquanto o app estiver em <b>modo de desenvolvimento</b>, a conta precisa estar adicionada como <b>testadora</b> do app (Funções do app → Testadores do Instagram) e aceitar o convite no Instagram.
          </li>
        </ol>
      </details>
    </div>
  );
}
