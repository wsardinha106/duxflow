import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Caminhos que não exigem sessão (a política de privacidade é exigida pela Meta). */
export function caminhoPublico(pathname: string): boolean {
  return pathname === "/login" || pathname === "/privacidade" || pathname.startsWith("/auth/") || pathname === "/api/cron/publicar";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/cron/publicar") return NextResponse.next();

  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar, headers) {
        for (const { name, value } of cookiesParaGravar) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaGravar) resposta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) resposta.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && !caminhoPublico(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (data.user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
