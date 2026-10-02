"use client";
import { useState } from "react";
import type { Conteudo } from "@/lib/tipos";
import { IconeImagem, IconePaginas, IconePlay } from "./Icones";

/** Miniatura do conteúdo. Se a imagem falhar, mostra um placeholder (nunca ícone quebrado). */
export function Miniatura({ conteudo, className = "", comSelo = true }: { conteudo: Conteudo; className?: string; comSelo?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  const reel = conteudo.tipo === "reel";
  const imagem = reel ? conteudo.capa_url : conteudo.midia_urls[0];
  const video = reel && !conteudo.capa_url ? conteudo.midia_urls[0] : null;

  return (
    <div className={`relative overflow-hidden bg-zinc-200 ${className}`}>
      {!falhou && imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagem} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      )}
      {!falhou && video && (
        <video src={`${video}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      )}
      {(falhou || (!imagem && !video)) && (
        <div className="flex h-full w-full items-center justify-center text-zinc-400">
          <IconeImagem width={16} height={16} />
        </div>
      )}
      {comSelo && (
        <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold leading-4 text-white">
          {reel ? <IconePlay width={9} height={9} /> : <IconePaginas width={9} height={9} />}
          {!reel && `1/${conteudo.midia_urls.length}`}
        </span>
      )}
    </div>
  );
}
