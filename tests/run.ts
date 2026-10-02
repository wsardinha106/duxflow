/**
 * Roda todas as suítes. Verde só quando passou = total em todas.
 * Bloqueia a rede: qualquer fetch real falha o teste.
 */
import type { Suite } from "./lib";

globalThis.fetch = (async (url: unknown) => {
  throw new Error(`Rede bloqueada nos testes (tentou acessar ${String(url)})`);
}) as typeof fetch;

const arquivos = ["estados", "legenda", "publicacao", "token", "datas", "instagram", "invariantes"];

async function main() {
  let passouTotal = 0;
  let total = 0;
  let falhou = false;
  for (const arq of arquivos) {
    let s: Suite;
    try {
      s = (await import(`./${arq}.test.ts`)).default as Suite;
    } catch (e) {
      console.log(`\n✗ suíte ${arq} não carregou: ${(e as Error).stack ?? e}`);
      falhou = true;
      continue;
    }
    let passou = 0;
    console.log(`\n${s.nome}`);
    for (const t of s.testes) {
      try {
        await t.fn();
        passou++;
        console.log(`  ✓ ${t.nome}`);
      } catch (e) {
        console.log(`  ✗ ${t.nome}\n      ${String((e as Error)?.message ?? e).split("\n").join("\n      ")}`);
      }
    }
    console.log(`  ${passou}/${s.testes.length} testes passaram`);
    passouTotal += passou;
    total += s.testes.length;
    if (passou !== s.testes.length || s.testes.length === 0) falhou = true;
  }
  console.log(`\nTOTAL: ${passouTotal}/${total} testes passaram`);
  if (falhou || passouTotal !== total) process.exit(1);
}

main().catch((e) => {
  console.error("Crash no runner:", e);
  process.exit(1);
});
