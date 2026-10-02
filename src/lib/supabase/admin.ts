import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cache: SupabaseClient | null = null;

/** Cliente com service role. Só no servidor, sempre depois de conferir a sessão ou o segredo do cron. */
export function criarClienteAdmin(): SupabaseClient {
  if (cache) return cache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  cache = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cache;
}
