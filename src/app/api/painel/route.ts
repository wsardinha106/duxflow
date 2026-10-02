import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";
import { OPS } from "@/lib/painel/ops";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Todas as ações do painel: { op, args }. Exige sessão; op fora da lista = 404. */
export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });

  let corpo: { op?: unknown; args?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }
  const nome = typeof corpo.op === "string" ? corpo.op : "";
  if (!Object.prototype.hasOwnProperty.call(OPS, nome)) {
    return NextResponse.json({ erro: "Operação desconhecida." }, { status: 404 });
  }
  const args = Array.isArray(corpo.args) ? corpo.args : [];

  try {
    const fn = OPS[nome as keyof typeof OPS] as (...a: unknown[]) => Promise<unknown>;
    const resultado = await fn(...args);
    return NextResponse.json({ resultado: resultado ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[painel:${nome}] ${msg}`);
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
}
