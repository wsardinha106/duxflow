"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CLIENTE } from "@/config/cliente";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { IconeCalendario, IconeConexao, IconeFechar, IconeFila, IconeMarca, IconeMenu, IconeSair } from "./Icones";

const ITENS = [
  { href: "/", rotulo: "Calendário", Icone: IconeCalendario },
  { href: "/fila", rotulo: "Fila", Icone: IconeFila },
  { href: "/conexoes", rotulo: "Conexões", Icone: IconeConexao },
];

/** Barra superior escura: links no desktop, menu sanduíche no celular. */
export function Shell({ email, children }: { email: string; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-zinc-950 text-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMenuAberto(false)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
              <IconeMarca width={20} height={20} />
            </span>
            <span className="text-lg font-bold tracking-tight">{CLIENTE.marca}</span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {ITENS.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${ativo(href) ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                <Icone width={16} height={16} /> {rotulo}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span className="max-w-56 truncate text-xs text-zinc-400">{email}</span>
            <button type="button" onClick={sair} className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">
              <IconeSair width={16} height={16} /> Sair
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
            className="ml-auto rounded-lg p-2 text-zinc-300 md:hidden"
          >
            {menuAberto ? <IconeFechar width={26} height={26} /> : <IconeMenu width={26} height={26} />}
          </button>
        </div>

        {menuAberto && (
          <div className="anim-subir border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-1">
              {ITENS.map(({ href, rotulo, Icone }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuAberto(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium ${ativo(href) ? "bg-white/10 text-white" : "text-zinc-300"}`}
                >
                  <Icone width={20} height={20} /> {rotulo}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t border-white/10 pt-3">
              <p className="truncate px-3 pb-2 text-xs text-zinc-500">{email}</p>
              <button type="button" onClick={sair} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base text-zinc-300">
                <IconeSair width={20} height={20} /> Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 md:px-8 md:pt-8">{children}</main>
    </div>
  );
}
