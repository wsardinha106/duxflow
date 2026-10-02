import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { CHAVES, lerConfiguracao } from "@/lib/servidor/configuracoes";
import { rodadaDePublicacao, SemTokenError } from "@/lib/servidor/publicador";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Compara o segredo em tempo constante. Tamanhos diferentes = recusa. */
function segredoConfere(recebido: string | null, esperado: string | null): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function executar(request: NextRequest) {
  const admin = criarClienteAdmin();
  let esperado: string | null;
  try {
    esperado = await lerConfiguracao(admin, CHAVES.cronSecret);
  } catch (e) {
    console.error(`[cron/publicar] ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ erro: "configuração indisponível" }, { status: 500 });
  }
  if (!segredoConfere(request.headers.get("x-cron-secret"), esperado)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  try {
    const resumo = await rodadaDePublicacao(admin);
    return NextResponse.json({
      processados: resumo.processados,
      publicados: resumo.publicados,
      falhas: resumo.falhas,
      renovacao: resumo.renovacao,
      itens: resumo.itens,
    });
  } catch (e) {
    if (e instanceof SemTokenError) return NextResponse.json({ erro: e.message }, { status: 503 });
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron/publicar] ${msg}`);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

export const GET = executar;
export const POST = executar;
