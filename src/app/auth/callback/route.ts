import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Recebe o link do e-mail do Supabase (redefinição de senha) e abre a sessão. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const codigo = url.searchParams.get("code");
  const proximo = url.searchParams.get("proximo") ?? "/";
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/";

  if (codigo) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/login?erro=link", url.origin));
}
