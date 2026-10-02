"use client";
import { useRef, useState } from "react";
import type { Conteudo } from "@/lib/tipos";
import { IconeDireita, IconeEsquerda, IconeImagem } from "./Icones";

function ImagemSegura({ src, alt }: { src: string; alt: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou)
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-100 text-xs text-zinc-400">
        <IconeImagem />
        Imagem indisponível
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} onError={() => setFalhou(true)} />;
}

/** Carrossel deslizável (scroll-snap) com setas e bolinhas. */
export function Carrossel({ imagens, alt, proporcao = "aspect-[4/5]" }: { imagens: string[]; alt?: string | null; proporcao?: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = (i: number) => {
    const el = trilho.current;
    if (!el) return;
    const alvo = Math.max(0, Math.min(imagens.length - 1, i));
    el.scrollTo({ left: alvo * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={`relative w-full ${proporcao} bg-zinc-100`}>
      <div
        ref={trilho}
        className="sem-barra flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {imagens.map((src, i) => (
          <div key={i} className="h-full w-full shrink-0 snap-center">
            <ImagemSegura src={src} alt={alt ?? `Imagem ${i + 1}`} />
          </div>
        ))}
      </div>
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        {atual + 1}/{imagens.length}
      </span>
      {atual > 0 && (
        <button type="button" aria-label="Anterior" onClick={() => irPara(atual - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow">
          <IconeEsquerda width={18} height={18} />
        </button>
      )}
      {atual < imagens.length - 1 && (
        <button type="button" aria-label="Próxima" onClick={() => irPara(atual + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow">
          <IconeDireita width={18} height={18} />
        </button>
      )}
      <div className="absolute inset-x-0 -bottom-5 flex justify-center gap-1">
        {imagens.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === atual ? "bg-sky-500" : "bg-zinc-300"}`} />
        ))}
      </div>
    </div>
  );
}

export function VideoReel({ src, capa, className = "aspect-[9/16]" }: { src: string; capa?: string | null; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou)
    return (
      <div className={`flex w-full flex-col items-center justify-center gap-1 bg-zinc-900 text-xs text-zinc-400 ${className}`}>
        <IconeImagem />
        Vídeo indisponível
      </div>
    );
  return (
    <video
      src={src}
      poster={capa ?? undefined}
      controls
      playsInline
      preload="metadata"
      className={`w-full bg-black object-contain ${className}`}
      onError={() => setFalhou(true)}
    />
  );
}

/** Prévia estilo Instagram, em moldura de celular. */
export function PreviaInstagram({ conteudo, usuario, legenda }: { conteudo: Conteudo; usuario: string; legenda: string }) {
  const [aberta, setAberta] = useState(false);
  const longa = Array.from(legenda).length > 125;
  const visivel = longa && !aberta ? Array.from(legenda).slice(0, 125).join("") : legenda;
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-[6px] border-zinc-900 bg-white shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[2px]">
          <span className="block h-full w-full rounded-full bg-white" />
        </span>
        <span className="text-[13px] font-semibold">{usuario.replace(/^@/, "")}</span>
      </div>
      {conteudo.tipo === "reel" ? (
        <VideoReel src={conteudo.midia_urls[0]} capa={conteudo.capa_url} className="aspect-[9/16] max-h-[460px]" />
      ) : (
        <Carrossel imagens={conteudo.midia_urls} alt={conteudo.alt_text} />
      )}
      <div className={`px-3 pb-4 text-[13px] leading-snug ${conteudo.tipo === "carrossel" ? "pt-7" : "pt-3"}`}>
        <span className="font-semibold">{usuario.replace(/^@/, "")}</span>{" "}
        <span className="whitespace-pre-wrap break-words">{visivel}</span>
        {longa && !aberta && (
          <button type="button" className="text-zinc-500" onClick={() => setAberta(true)}>
            … mais
          </button>
        )}
      </div>
    </div>
  );
}
