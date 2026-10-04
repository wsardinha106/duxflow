/** Invariantes de segurança e consistência verificadas por leitura de código. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { assert, suite } from "./lib";
import { HORA_DO_SLOT } from "@/config/cliente";

const RAIZ = join(__dirname, "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function arquivos(dir: string, ext = /\.(ts|tsx|js|mjs|sql)$/): string[] {
  const r: string[] = [];
  for (const nome of readdirSync(join(RAIZ, dir))) {
    const caminho = join(dir, nome);
    if (statSync(join(RAIZ, caminho)).isDirectory()) r.push(...arquivos(caminho, ext));
    else if (ext.test(nome)) r.push(caminho);
  }
  return r;
}

const migrations = () => arquivos("supabase/migrations").map((p) => ler(p)).join("\n");
const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

export default suite("Invariantes (leitura de código)", (t) => {
  t("migration de configuracoes tem RLS e REVOKE para anon e authenticated", () => {
    const sql = semComentarios(migrations());
    assert.match(sql, /CREATE TABLE[^;]*configuracoes/i);
    assert.match(sql, /ALTER TABLE\s+configuracoes\s+ENABLE ROW LEVEL SECURITY/i);
    assert.match(sql, /REVOKE ALL ON configuracoes FROM anon,\s*authenticated/i);
    assert.doesNotMatch(sql, /GRANT[^;]*ON\s+(TABLE\s+)?configuracoes[^;]*TO\s+(anon|authenticated|PUBLIC)/i);
    assert.doesNotMatch(sql, /CREATE POLICY[^;]*ON\s+configuracoes/i);
  });

  t("conteudos_instagram tem RLS, policies só para authenticated e REVOKE de anon", () => {
    const sql = semComentarios(migrations());
    assert.match(sql, /ALTER TABLE conteudos_instagram ENABLE ROW LEVEL SECURITY/i);
    assert.match(sql, /REVOKE ALL ON conteudos_instagram FROM anon/i);
    for (const m of sql.matchAll(/CREATE POLICY[^;]*ON conteudos_instagram[^;]*;/gi)) assert.match(m[0], /TO authenticated/i);
  });

  t("reserva usa FOR UPDATE SKIP LOCKED e devolve presos após 15 min", () => {
    const sql = migrations();
    assert.match(sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(sql, /interval '15 minutes'/);
  });

  t("agendador é o pg_cron a cada 5 minutos (e não GitHub Actions/Vercel Cron)", () => {
    assert.match(migrations(), /cron\.schedule\('publicar-conteudos',\s*'\*\/5 \* \* \* \*'/);
    assert.match(migrations(), /timeout_milliseconds := 290000/);
    let temWorkflow = true;
    try { readdirSync(join(RAIZ, ".github/workflows")); } catch { temWorkflow = false; }
    assert.equal(temWorkflow, false, "não use GitHub Actions como agendador");
    let vercel = "";
    try { vercel = ler("vercel.json"); } catch { /* sem vercel.json */ }
    assert.doesNotMatch(vercel, /"crons"/);
  });

  t("horários dos slots no SQL batem com src/config/cliente.ts", () => {
    const sql = migrations();
    const dois = (n: number) => String(n).padStart(2, "0");
    for (const [tipo, { hora, minuto }] of Object.entries(HORA_DO_SLOT)) {
      const re = new RegExp(`p_tipo = '${tipo}' THEN RETURN time '${dois(hora)}:${dois(minuto)}'`);
      assert.match(sql, re, `slot de ${tipo}`);
    }
  });

  t("rota do cron usa timingSafeEqual, recusa tamanhos diferentes e tem maxDuration 300", () => {
    const rota = ler("src/app/api/cron/publicar/route.ts");
    assert.match(rota, /timingSafeEqual\(/);
    assert.match(rota, /length !== .*length\) return false/);
    assert.match(rota, /x-cron-secret/);
    assert.match(rota, /status: 401/);
    assert.match(rota, /status: 503/);
    assert.match(rota, /export const maxDuration = 300/);
  });

  t("nenhum NEXT_PUBLIC_ além da URL e da anon key", () => {
    const permitidos = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    const fontes = [...arquivos("src"), "next.config.ts", ...(() => { try { return [".env.example"].filter((p) => ler(p)); } catch { return []; } })()];
    for (const p of fontes) {
      for (const m of ler(p).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) assert.ok(permitidos.has(m[0]), `${m[0]} em ${p}`);
    }
  });

  t("service role e token nunca em código de cliente", () => {
    for (const p of arquivos("src")) {
      const c = ler(p);
      if (!/^["']use client["']/m.test(c)) continue;
      assert.doesNotMatch(c, /SUPABASE_SERVICE_ROLE_KEY|supabase\/admin|servidor\/|ig_access_token/, `${p}`);
      assert.doesNotMatch(c, /^import (?!type )[^;]*from ["']@\/lib\/painel\/ops["']/m, `${p} importa ops.ts em runtime`);
    }
  });

  t("nome da chave do token só aparece no módulo de configurações", () => {
    const onde = arquivos("src").filter((p) => ler(p).includes("ig_access_token")).map((p) => relative(RAIZ, join(RAIZ, p)));
    assert.deepEqual(onde, ["src/lib/servidor/configuracoes.ts"]);
  });

  t("nenhuma rota/operação devolve o token", () => {
    const rotas = arquivos("src/app").filter((p) => /route\.ts$/.test(p));
    for (const p of [...rotas, "src/lib/painel/ops.ts"]) {
      const c = ler(p);
      assert.doesNotMatch(c, /return[^;\n]*CHAVES\.token\b/, `${p} devolve CHAVES.token`);
      assert.doesNotMatch(c, /return[^;\n]*[{,]\s*(token|tokenFinal|access_token)\s*[,}]/, `${p} devolve token`);
      assert.doesNotMatch(c, /return[^;\n]*:\s*token\b(?!\.)/, `${p} devolve token`);
      assert.doesNotMatch(c, /access_token/, `${p}`);
    }
    const ops = ler("src/lib/painel/ops.ts");
    const status = /export interface StatusConexao \{([^}]*)\}/.exec(ops)?.[1] ?? "";
    assert.ok(status.length > 0);
    assert.doesNotMatch(status, /token/i, "StatusConexao não pode ter campo de token");
  });

  t("nenhum arquivo 'use server' (ações vão por /api/painel)", () => {
    for (const p of arquivos("src")) assert.doesNotMatch(ler(p), /^["']use server["']/m, p);
  });

  t("/api/painel exige sessão e tem lista fechada de operações", () => {
    const rota = ler("src/app/api/painel/route.ts");
    assert.match(rota, /usuarioAtual\(\)/);
    assert.match(rota, /hasOwnProperty\.call\(OPS, nome\)/);
    assert.match(rota, /status: 404/);
  });

  t("proxy libera só /login, /privacidade, /auth/* e o cron", () => {
    const proxy = ler("src/proxy.ts");
    assert.match(proxy, /pathname === "\/login"/);
    assert.match(proxy, /pathname === "\/privacidade"/);
    assert.match(proxy, /startsWith\("\/auth\/"\)/);
    assert.match(proxy, /"\/api\/cron\/publicar"/);
  });

  t("modais usam createPortal", () => {
    const comp = arquivos("src/components").map(ler).join("\n");
    assert.match(comp, /createPortal\([^)]*document\.body/s);
  });
});
