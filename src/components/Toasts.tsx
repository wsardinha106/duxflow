"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Portal } from "./Portal";

type Tipo = "sucesso" | "erro" | "info";
interface Toast {
  id: number;
  tipo: Tipo;
  texto: string;
  link?: { href: string; rotulo: string };
}

type Mostrar = (tipo: Tipo, texto: string, link?: Toast["link"]) => void;
const Contexto = createContext<Mostrar>(() => {});

export function useToast() {
  return useContext(Contexto);
}

let proximoId = 1;

export function ProvedorToasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mostrar = useCallback<Mostrar>((tipo, texto, link) => {
    const id = proximoId++;
    setToasts((t) => [...t.slice(-3), { id, tipo, texto, link }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === "erro" || link ? 7000 : 3500);
  }, []);

  const cor: Record<Tipo, string> = {
    sucesso: "bg-emerald-600",
    erro: "bg-red-600",
    info: "bg-zinc-800",
  };

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} role="status" className={`anim-subir pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm text-white shadow-lg ${cor[t.tipo]}`}>
              {t.texto}
              {t.link && (
                <a href={t.link.href} target="_blank" rel="noreferrer" className="ml-2 font-semibold underline">
                  {t.link.rotulo}
                </a>
              )}
            </div>
          ))}
        </div>
      </Portal>
    </Contexto.Provider>
  );
}
