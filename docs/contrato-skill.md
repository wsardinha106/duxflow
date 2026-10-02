# Contrato da skill de criação de conteúdo

A skill (rodando no computador do operador) **cria** os conteúdos e coloca na
fila como `pendente`. O painel só aprova e publica. O sistema é de **um
cliente só**: não existe `tenant_id`.

## Credenciais

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **deste** projeto.
- A skill **não** tem e **não** deve ter o token do Instagram.

## Passo 1 — subir os arquivos

Bucket `conteudos-instagram` (público para leitura), caminho
`<AAAA>/<MM>/<slug>-<hhmmss>/<arquivo>`, com `upsert: false`. Depois pegue a
URL pública com `getPublicUrl`.

| Tipo | Arquivos | Formato |
|---|---|---|
| Reel | `video.mp4` (+ `capa.jpg` opcional) | MP4 H.264 + AAC, 9:16 (1080×1920), 3–90 s, até 1 GB |
| Carrossel | `01.jpg` … `10.jpg` (2 a 10) | JPEG 1080×1350 (4:5) ou 1080×1080, até 8 MB cada |

## Passo 2 — data

`rpc('proxima_data_livre', { p_tipo })` devolve o próximo dia livre daquele
tipo, no horário do slot (reel 06:00, carrossel 15:00, Brasília). Um por dia
de cada tipo. Para vários itens do mesmo tipo, chame **antes de cada**
inserção.

## Passo 3 — inserir em `conteudos_instagram`

- **Obrigatórios:** `tipo` (`reel` | `carrossel`), `status: 'pendente'`,
  `data_agendada` (da RPC), `midia_urls` (reel: 1; carrossel: 2–10, na
  ordem), `descricao` (sem hashtags).
- **Recomendados:** `capa_url`, `hashtags` (sem `#`, até 30), `alt_text`,
  `palavra_chave`, `tema`, `origem_url`, `origem_trecho`, `nota` (0–10).
- **Não preencher:** `conta_instagram_id`, `ig_*`, `erro`, `tentativas`,
  `aprovado_em`, `publicado_em`, `publicando_desde`.

## Exemplo completo (`@supabase/supabase-js`)

```js
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const BUCKET = "conteudos-instagram";

function pasta(slug) {
  const agora = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const hhmmss = `${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`;
  return `${agora.getFullYear()}/${p(agora.getMonth() + 1)}/${slug}-${hhmmss}`;
}

async function subir(destino, arquivoLocal, contentType) {
  const corpo = await readFile(arquivoLocal);
  const { error } = await supabase.storage.from(BUCKET).upload(destino, corpo, { contentType, upsert: false });
  if (error) throw new Error(`Upload de ${destino} falhou: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl;
}

async function proximaData(tipo) {
  const { data, error } = await supabase.rpc("proxima_data_livre", { p_tipo: tipo });
  if (error) throw new Error(`proxima_data_livre falhou: ${error.message}`);
  return data;
}

async function inserir(linha) {
  const { data, error } = await supabase.from("conteudos_instagram").insert(linha).select("id, data_agendada").single();
  if (error) throw new Error(`Inserção falhou: ${error.message}`);
  return data;
}

export async function enviarReel({ slug, video, capa, descricao, hashtags = [], altText, palavraChave, tema, origemUrl, origemTrecho, nota }) {
  const dir = pasta(slug);
  const videoUrl = await subir(`${dir}/video.mp4`, video, "video/mp4");
  const capaUrl = capa ? await subir(`${dir}/capa.jpg`, capa, "image/jpeg") : null;
  return inserir({
    tipo: "reel",
    status: "pendente",
    data_agendada: await proximaData("reel"),
    midia_urls: [videoUrl],
    capa_url: capaUrl,
    descricao,
    hashtags: hashtags.map((h) => h.replace(/^#+/, "")).slice(0, 30),
    alt_text: altText ?? null,
    palavra_chave: palavraChave ?? null,
    tema: tema ?? null,
    origem_url: origemUrl ?? null,
    origem_trecho: origemTrecho ?? null,
    nota: nota ?? null,
  });
}

export async function enviarCarrossel({ slug, imagens, descricao, hashtags = [], altText, palavraChave, tema, origemUrl, origemTrecho, nota }) {
  if (imagens.length < 2 || imagens.length > 10) throw new Error("Carrossel precisa de 2 a 10 imagens.");
  const dir = pasta(slug);
  const urls = [];
  for (const [i, arquivo] of imagens.entries()) {
    const nome = `${String(i + 1).padStart(2, "0")}${path.extname(arquivo) || ".jpg"}`;
    urls.push(await subir(`${dir}/${nome}`, arquivo, "image/jpeg"));
  }
  return inserir({
    tipo: "carrossel",
    status: "pendente",
    data_agendada: await proximaData("carrossel"),
    midia_urls: urls,
    descricao,
    hashtags: hashtags.map((h) => h.replace(/^#+/, "")).slice(0, 30),
    alt_text: altText ?? null,
    palavra_chave: palavraChave ?? null,
    tema: tema ?? null,
    origem_url: origemUrl ?? null,
    origem_trecho: origemTrecho ?? null,
    nota: nota ?? null,
  });
}
```

## O que acontece depois

| Status | Quando | Quem |
|---|---|---|
| `pendente` | A skill inseriu. Aparece na Fila e no Calendário. | skill |
| `agendado` | O cliente aprovou no painel. | cliente |
| `publicando` | Chegou o horário: o pg_cron (a cada 5 min) reservou o item, ou o cliente clicou em “Publicar agora”. | sistema |
| `publicado` | A Meta publicou. O card ganha o link “Ver no Instagram”. | sistema |
| `agendado` de novo | A publicação falhou (1ª ou 2ª vez). Tenta de novo na próxima rodada. | sistema |
| `erro` | Falhou 3 vezes. O cliente vê o motivo e pode “Tentar de novo”. | sistema |
| `descartado` | O cliente descartou (opcionalmente puxando os próximos um dia). | cliente |
