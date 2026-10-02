import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente com a sessão do usuário (cookies), para conferir quem está logado. */
export async function criarClienteServidor() {
  const loja = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(cookiesParaGravar) {
        try {
          for (const { name, value, options } of cookiesParaGravar) loja.set(name, value, options);
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}

/** Usuário logado ou null (valida o JWT no Supabase). */
export async function usuarioAtual() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
