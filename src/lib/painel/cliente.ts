"use client";
/**
 * Cliente das operações do painel: mesmas assinaturas de ops.ts, via /api/painel.
 * Só importa TIPOS de ops.ts (apagados na compilação).
 */
type Ops = typeof import("@/lib/painel/ops").OPS;

export async function op<K extends keyof Ops>(nome: K, ...args: Parameters<Ops[K]>): Promise<Awaited<ReturnType<Ops[K]>>> {
  let resp: Response;
  try {
    resp = await fetch("/api/painel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: nome, args }),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Confira a internet e tente de novo.");
  }
  const json = (await resp.json().catch(() => ({}))) as { resultado?: unknown; erro?: string };
  if (resp.status === 401) {
    window.location.replace(new URL("/login", window.location.origin));
    throw new Error(json.erro ?? "Sessão expirada.");
  }
  if (!resp.ok) throw new Error(json.erro ?? `Erro ${resp.status}`);
  return json.resultado as Awaited<ReturnType<Ops[K]>>;
}
