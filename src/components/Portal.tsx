"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const assinar = () => () => {};

/** Renderiza no <body> para não ficar preso em containers com `transform`. */
export function Portal({ children }: { children: ReactNode }) {
  const noNavegador = useSyncExternalStore(assinar, () => true, () => false);
  if (!noNavegador) return null;
  return createPortal(children, document.body);
}
