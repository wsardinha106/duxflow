# Painel de Conteúdos Instagram

Painel de **um cliente só** para aprovar e publicar automaticamente Reels e
carrosséis no Instagram. Os conteúdos chegam pela skill externa
([docs/contrato-skill.md](docs/contrato-skill.md)); o painel mostra a fila e o
calendário, o cliente aprova, e o pg_cron publica no horário pela Instagram
API, renovando o token a cada 24h.

Stack: Next.js (App Router) + Tailwind · Supabase (Postgres, Auth, Storage,
pg_cron + pg_net) · Vercel.

## 0. Dados do cliente

Edite `src/config/cliente.ts` (nome, @, URL de produção, horários dos slots).
Se mudar os horários, mude também `conteudo_hora_do_slot` em
`supabase/migrations/0002_funcoes.sql` (um teste confere).

## 1. Criar o projeto Supabase

1. Crie um projeto em supabase.com (região São Paulo, de preferência).
2. **Authentication → Providers → Email**: deixe ligado e **desmarque
   “Enable sign ups”** (sem cadastro público).
3. **Authentication → URL Configuration**: *Site URL* = URL de produção;
   adicione `https://SEU-PROJETO.vercel.app/auth/callback` em *Redirect URLs*
   (link de “Esqueci a senha”).
4. **Database → Extensions**: as migrations ligam `pg_cron` e `pg_net`; se
   o projeto não permitir pelo SQL, ligue as duas por aqui.

## 2. Aplicar as migrations

No **SQL Editor**, rode em ordem o conteúdo de:

1. `supabase/migrations/0001_tabelas.sql` — tabelas, RLS, bucket
2. `supabase/migrations/0002_funcoes.sql` — RPCs da fila
3. `supabase/migrations/0003_agendador.sql` — pg_cron + segredo do cron

(Ou `supabase link` + `supabase db push` com a CLI.) As migrations podem ser
reaplicadas sem erro.

## 3. Deploy na Vercel

Variáveis de ambiente (só estas — veja `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

O token do Instagram **não** vai em variável de ambiente: ele é colado na
tela Conexões e fica na tabela fechada `configuracoes`.

## 4. Ajustar a URL de produção no pg_cron

A função `disparar_publicacao()` chama `<app_url>/api/cron/publicar` a cada
5 minutos. Depois do primeiro deploy, rode no SQL Editor:

```sql
UPDATE configuracoes SET valor = 'https://SEU-PROJETO.vercel.app', updated_at = now()
 WHERE chave = 'app_url';
```

Para conferir: `SELECT * FROM cron.job;` e, depois de uns minutos,
`SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`.

## 5. Criar os usuários

**Authentication → Users → Add user → Create new user**, com os e-mails de
quem vai entrar no painel (marque *Auto Confirm User*). Não há tela de
cadastro.

## 6. Conectar o Instagram

Entre no painel → **Conexões** → siga o passo a passo da própria tela
(app na Meta, “Gerar token”, permissões `instagram_business_basic` e
`instagram_business_content_publish`) e cole o token. A tela mostra @, foto,
seguidores e a validade; o token é trocado por um de 60 dias e renovado
sozinho a cada 24h.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```

Checagens (todas precisam passar):

```bash
npm test            # todas as suítes, sem rede; verde só com passou = total
npm run typecheck   # tsc --noEmit
npm run lint
npm run build
scripts/testar-sql.sh   # opcional: migrations num Postgres local descartável
```

## Como funciona

- **Fila**: a skill insere como `pendente` na próxima vaga
  (`proxima_data_livre`, um por dia de cada tipo).
- **Aprovação**: tudo passa por `POST /api/painel` (`{op, args}`, lista
  fechada em `src/lib/painel/ops.ts`), que confere a sessão e usa a service
  role. O navegador nunca escreve direto no banco.
- **Publicação**: pg_cron → `disparar_publicacao()` → `GET /api/cron/publicar`
  com `x-cron-secret` (comparado com `timingSafeEqual`). A rota renova o
  token se preciso, reserva até 5 itens (`FOR UPDATE SKIP LOCKED`), publica em
  sequência e grava o resultado. Falha → tenta de novo até a 3ª vez; item
  preso em `publicando` por 15 min volta para a fila.
