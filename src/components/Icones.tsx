import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const IconePlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z" /></svg>
);
export const IconePaginas = (p: P) => (
  <svg {...base(p)}><rect x="7" y="3" width="13" height="15" rx="2" /><path d="M4 7v12a2 2 0 0 0 2 2h10" /></svg>
);
export const IconeCalendario = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>
);
export const IconeFila = (p: P) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h10" /><path d="m17 16 2 2 3-4" /></svg>
);
export const IconeConexao = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
);
export const IconeSair = (p: P) => (
  <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
);
export const IconeFechar = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconeEsquerda = (p: P) => (
  <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
);
export const IconeDireita = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconeLink = (p: P) => (
  <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
);
export const IconeImagem = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>
);
export const IconeMenu = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
/** Marca do painel: um fluxo que vira seta. */
export const IconeMarca = (p: P) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M4 7h9a4 4 0 0 1 0 8H7" /><path d="m10 12-3 3 3 3" /></svg>
);
