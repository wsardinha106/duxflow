import "server-only";
/**
 * Operações do painel. Rodam só no servidor, com a service role, DEPOIS de
 * /api/painel conferir a sessão. Expostas por uma lista fechada (OPS) — não
 * são server actions (ver §11.6 do prompt).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { podeExecutar, statusApos, statusQuePermitem, type Acao } from "@/lib/regras/estados";
import { normalizarHashtags } from "@/lib/regras/legenda";
import { deInputLocal } from "@/lib/regras/datas";
import { criarClienteInstagram, ErroInstagram } from "@/lib/instagram/api";
import { CHAVES, gravarConfiguracoes, lerConfiguracoes } from "@/lib/servidor/configuracoes";
import { conectarToken } from "@/lib/servidor/token";
import { abrirInstagram, publicarItemReservado, SemTokenError } from "@/lib/servidor/publicador";
import { mascararMensagem } from "@/lib/regras/publicacao";
import type { Conteudo, Status } from "@/lib/tipos";

const TABELA = "conteudos_instagram";
const PAGINA = 1000;

function db(): SupabaseClient {
  return criarClienteAdmin();
}

async function buscar(id: string): Promise<Conteudo> {
  const { data, error } = await db().from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conteúdo não encontrado.");
  return data as Conteudo;
}

/**
 * Aplica uma ação com a mesma máquina de estados da tela. O UPDATE também
 * filtra pelos status de origem permitidos, para não colidir com o cron.
 */
async function transicionar(id: string, acao: Acao, extra: Partial<Conteudo> = {}): Promise<Conteudo> {
  const atual = await buscar(id);
  const novo = statusApos(atual.status, acao); // lança se proibida
  const { data, error } = await db()
    .from(TABELA)
    .update({ ...extra, status: novo })
    .eq("id", id)
    .in("status", statusQuePermitem(acao))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("O conteúdo mudou de status enquanto você agia. Atualize a tela.");
  return data as Conteudo;
}

/** Lê todas as linhas paginando (o Supabase corta em 1000). */
async function lerTudo(montar: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Conteudo[]> {
  const todos: Conteudo[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as Conteudo[];
    todos.push(...lote);
    if (lote.length < PAGINA) return todos;
  }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listarConteudos(de: string, ate: string): Promise<Conteudo[]> {
  return lerTudo((a, b) =>
    db().from(TABELA).select("*").gte("data_agendada", de).lt("data_agendada", ate).order("data_agendada").order("id").range(a, b),
  );
}

export async function listarPendentes(): Promise<Conteudo[]> {
  return lerTudo((a, b) => db().from(TABELA).select("*").eq("status", "pendente").order("data_agendada").order("id").range(a, b));
}

/** Todos os itens de um status: os que ainda vão sair primeiro; publicados do mais recente. */
export async function listarPorStatus(status: Status): Promise<Conteudo[]> {
  const recentesPrimeiro = status === "publicado" || status === "descartado";
  return lerTudo((a, b) =>
    db().from(TABELA).select("*").eq("status", String(status)).order("data_agendada", { ascending: !recentesPrimeiro }).order("id").range(a, b),
  );
}

export async function contarPorStatus(): Promise<Record<Status, number>> {
  const status: Status[] = ["pendente", "agendado", "publicando", "publicado", "erro", "descartado"];
  const r = {} as Record<Status, number>;
  await Promise.all(
    status.map(async (s) => {
      const { count, error } = await db().from(TABELA).select("id", { count: "exact", head: true }).eq("status", s);
      if (error) throw new Error(error.message);
      r[s] = count ?? 0;
    }),
  );
  return r;
}

export async function obterConteudo(id: string): Promise<Conteudo> {
  return buscar(id);
}

// ---------------------------------------------------------------------------
// Ações (§7)
// ---------------------------------------------------------------------------

export async function aprovar(id: string): Promise<Conteudo> {
  return transicionar(id, "aprovar", { aprovado_em: new Date().toISOString() });
}

export async function aprovarTodosPendentes(): Promise<number> {
  const { data, error } = await db()
    .from(TABELA)
    .update({ status: "agendado", aprovado_em: new Date().toISOString() })
    .eq("status", "pendente")
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function descartar(id: string, puxarFila: boolean): Promise<{ conteudo: Conteudo; puxados: number }> {
  const conteudo = await transicionar(id, "descartar");
  let puxados = 0;
  if (puxarFila) {
    const { data, error } = await db().rpc("puxar_fila", { p_tipo: conteudo.tipo, p_a_partir_de: conteudo.data_agendada });
    if (error) throw new Error(`Descartado, mas não foi possível puxar a fila: ${error.message}`);
    puxados = Number(data ?? 0);
  }
  return { conteudo, puxados };
}

export async function voltarParaPendente(id: string): Promise<Conteudo> {
  return transicionar(id, "voltar_pendente", { aprovado_em: null });
}

export async function tentarDeNovo(id: string): Promise<Conteudo> {
  return transicionar(id, "tentar_de_novo", { tentativas: 0, erro: null });
}

export interface CamposEdicao {
  descricao?: string;
  hashtags?: string[] | string;
  alt_text?: string | null;
  palavra_chave?: string | null;
  /** Valor de <input type="datetime-local">, em horário de Brasília. */
  data_local?: string;
}

export async function editar(id: string, campos: CamposEdicao): Promise<Conteudo> {
  const extra: Partial<Conteudo> = {};
  if (campos.descricao !== undefined) extra.descricao = String(campos.descricao);
  if (campos.hashtags !== undefined) extra.hashtags = normalizarHashtags(campos.hashtags);
  if (campos.alt_text !== undefined) extra.alt_text = campos.alt_text?.trim() || null;
  if (campos.palavra_chave !== undefined) extra.palavra_chave = campos.palavra_chave?.trim() || null;
  if (campos.data_local) extra.data_agendada = deInputLocal(campos.data_local).toISOString();
  return transicionar(id, "editar", extra);
}

/**
 * Reserva só este item (UPDATE condicionado ao status, para não colidir com o
 * cron) e publica na hora.
 */
export async function publicarAgora(id: string): Promise<{ ok: boolean; permalink: string | null; erro: string | null }> {
  const atual = await buscar(id);
  if (!podeExecutar(atual.status, "publicar_agora")) statusApos(atual.status, "publicar_agora");
  const admin = db();
  const { data, error } = await admin
    .from(TABELA)
    .update({ status: "publicando", publicando_desde: new Date().toISOString(), aprovado_em: atual.aprovado_em ?? new Date().toISOString() })
    .eq("id", id)
    .in("status", statusQuePermitem("publicar_agora"))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este conteúdo já está sendo publicado ou mudou de status.");
  const item = data as Conteudo;

  // Sem conexão com o Instagram, o item volta exatamente como estava.
  const devolver = async (msg: string) => {
    await admin.from(TABELA).update({ status: atual.status, aprovado_em: atual.aprovado_em, erro: msg, publicando_desde: null }).eq("id", id);
    return { ok: false, permalink: null, erro: msg };
  };
  let conexao;
  try {
    conexao = await abrirInstagram(admin);
  } catch (e) {
    return devolver(mascararMensagem(e));
  }
  if (!conexao) return devolver(new SemTokenError().message);
  const r = await publicarItemReservado(admin, conexao.ig, conexao.igUserId, item, conexao.token);
  return r.ok ? { ok: true, permalink: r.permalink, erro: null } : { ok: false, permalink: null, erro: r.erro };
}

// ---------------------------------------------------------------------------
// Conexões (§5). O token NUNCA sai daqui: só @, nome, foto e datas.
// ---------------------------------------------------------------------------

export interface StatusConexao {
  conectado: boolean;
  username: string | null;
  nome: string | null;
  foto: string | null;
  seguidores: number | null;
  posts: number | null;
  renovadoEm: string | null;
  expiraEm: string | null;
  erroRenovacao: string | null;
  problema: string | null;
}

export async function statusConexao(): Promise<StatusConexao> {
  const admin = db();
  const cfg = await lerConfiguracoes(admin, [CHAVES.token, CHAVES.username, CHAVES.renovadoEm, CHAVES.expiraEm, CHAVES.erroToken]);
  const base: StatusConexao = {
    conectado: false,
    username: cfg[CHAVES.username] ?? null,
    nome: null,
    foto: null,
    seguidores: null,
    posts: null,
    renovadoEm: cfg[CHAVES.renovadoEm] ?? null,
    expiraEm: cfg[CHAVES.expiraEm] ?? null,
    erroRenovacao: cfg[CHAVES.erroToken] ?? null,
    problema: null,
  };
  const token = cfg[CHAVES.token];
  if (!token) return { ...base, problema: "Nenhum token conectado ainda." };

  try {
    const p = await criarClienteInstagram({ token }).me();
    return {
      ...base,
      conectado: true,
      username: p.username ?? base.username,
      nome: p.name ?? null,
      foto: p.profile_picture_url ?? null,
      seguidores: p.followers_count ?? null,
      posts: p.media_count ?? null,
    };
  } catch (e) {
    const venceu = base.expiraEm && new Date(base.expiraEm).getTime() < Date.now();
    let problema: string;
    if (e instanceof ErroInstagram && e.tokenRecusado) {
      problema = venceu
        ? `O token venceu em ${new Date(base.expiraEm!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}. Gere um novo e cole aqui.`
        : "O Instagram recusou o token salvo (vencido ou revogado). Gere um novo e cole aqui.";
    } else {
      problema = `Não foi possível falar com o Instagram agora: ${mascararMensagem(e, token)}`;
    }
    return { ...base, problema };
  }
}

export async function conectar(token: string): Promise<StatusConexao> {
  await conectarToken(db(), String(token ?? ""));
  return statusConexao();
}

export async function testarConexao(): Promise<StatusConexao> {
  return statusConexao();
}

export async function desconectar(): Promise<StatusConexao> {
  await gravarConfiguracoes(db(), {
    [CHAVES.token]: null,
    [CHAVES.renovadoEm]: null,
    [CHAVES.expiraEm]: null,
    [CHAVES.erroToken]: null,
  });
  return statusConexao();
}

/** Lista fechada de operações aceitas por /api/painel. Nome fora daqui = 404. */
export const OPS = {
  listarConteudos,
  listarPendentes,
  listarPorStatus,
  contarPorStatus,
  obterConteudo,
  aprovar,
  aprovarTodosPendentes,
  descartar,
  voltarParaPendente,
  tentarDeNovo,
  editar,
  publicarAgora,
  statusConexao,
  conectar,
  testarConexao,
  desconectar,
} as const;

export type Ops = typeof OPS;
export type NomeOp = keyof Ops;
