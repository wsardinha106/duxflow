"use client";
import { useEffect, type ReactNode } from "react";
import { Portal } from "./Portal";

/** Diálogo central (via portal). */
export function Modal({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="anim-subir w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-3 text-base font-semibold">{titulo}</h2>
          {children}
        </div>
      </div>
    </Portal>
  );
}
