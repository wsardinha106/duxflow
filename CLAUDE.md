@AGENTS.md

# Painel de Conteúdos Instagram

- Tudo em português do Brasil; horários sempre em America/Sao_Paulo (`src/lib/regras/datas.ts`).
- Regras puras em `src/lib/regras/` (máquina de estados, legenda, publicação, token) — a tela e o servidor usam as mesmas funções.
- Ações do painel: `src/lib/painel/ops.ts` + `/api/painel` (lista fechada). Nunca use `'use server'`.
- O token do Instagram fica só em `configuracoes` (service role); nunca devolva para o navegador.
- Antes de entregar: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
