"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador: só para login/sessão. Nunca escreve nas tabelas. */
export function criarClienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
