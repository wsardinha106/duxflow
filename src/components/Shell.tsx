"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CLIENTE } from "@/config/cliente";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { IconeCalendario, IconeConexao, IconeFila, IconeSair } from "./Icones";

const ITENS = [
  { href: "/", rotulo: "Calendário", Icone: IconeCalendario },
  { href: "/fila", rotulo: "Fila", Icone: IconeFila },
  { href: "/conexoes", rotulo: "Conexões", Icone: IconeConexao },
];

/** Menu lateral no desktop, barra inferior no celular. */
export function Shell({ email, children }: { email: string; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="px-5 py-5">
          <p className="text-base font-bold leading-tight">{CLIENTE.nome}</p>
          <p className="text-xs text-zinc-500">{CLIENTE.instagram}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {ITENS.map(({ href, rotulo, Icone }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${ativo(href) ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              <Icone width={18} height={18} /> {rotulo}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <p className="truncate px-3 pb-2 text-xs text-zinc-500">{email}</p>
          <button type="button" onClick={sair} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100">
            <IconeSair width={18} height={18} /> Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{CLIENTE.nome}</p>
          <p className="text-[11px] text-zinc-500">{CLIENTE.instagram}</p>
        </div>
        <button type="button" onClick={sair} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-600" aria-label="Sair">
          <IconeSair width={16} height={16} /> Sair
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-4 md:px-8 md:pb-10 md:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${ativo(href) ? "text-zinc-900" : "text-zinc-400"}`}>
            <Icone width={22} height={22} />
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
