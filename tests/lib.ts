/** Mini-harness de testes: sem dependências, sem rede. */
import { strict as assert } from "node:assert";

export { assert };

export interface Teste {
  nome: string;
  fn: () => void | Promise<void>;
}

export interface Suite {
  nome: string;
  testes: Teste[];
}

export function suite(nome: string, definir: (t: (nome: string, fn: Teste["fn"]) => void) => void): Suite {
  const testes: Teste[] = [];
  definir((n, fn) => testes.push({ nome: n, fn }));
  return { nome, testes };
}

/** fetch falso: registra as chamadas e responde com a fila de respostas. */
export interface ChamadaFalsa {
  url: string;
  metodo: string;
  headers: Record<string, string>;
  corpo: URLSearchParams;
}

export type Resposta = { status?: number; json: unknown } | ((c: ChamadaFalsa) => { status?: number; json: unknown });

export function fetchFalso(respostas: Resposta[]) {
  const chamadas: ChamadaFalsa[] = [];
  const fila = [...respostas];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const chamada: ChamadaFalsa = {
      url,
      metodo: init?.method ?? "GET",
      headers,
      corpo: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    };
    chamadas.push(chamada);
    const prox = fila.shift();
    if (!prox) throw new Error(`fetch falso sem resposta para ${chamada.metodo} ${url}`);
    const r = typeof prox === "function" ? prox(chamada) : prox;
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
  return { fn, chamadas, restantes: () => fila.length };
}
