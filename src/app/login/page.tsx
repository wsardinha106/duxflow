import type { Metadata } from "next";
import { CLIENTE } from "@/config/cliente";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const { erro, senha } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600" />
          <h1 className="text-xl font-bold">{CLIENTE.nome}</h1>
          <p className="text-sm text-zinc-500">Conteúdos do Instagram {CLIENTE.instagram}</p>
        </div>
        <FormLogin erroInicial={erro === "link" ? "O link expirou ou é inválido. Peça um novo em “Esqueci a senha”." : null} senhaAlterada={senha === "ok"} />
      </div>
    </main>
  );
}
