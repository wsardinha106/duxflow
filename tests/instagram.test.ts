import { assert, fetchFalso, suite, type ChamadaFalsa } from "./lib";
import { BASE, criarClienteInstagram, ErroInstagram } from "@/lib/instagram/api";

const TOKEN = "IGAAtoken-secreto-de-teste-1234567890";

function semTokenNaUrl(chamadas: ChamadaFalsa[]) {
  for (const c of chamadas) {
    assert.ok(!c.url.includes(TOKEN), `token na URL: ${c.url}`);
    assert.ok(!new URL(c.url).searchParams.has("access_token"), `access_token na URL: ${c.url}`);
    assert.equal(c.headers.Authorization, `Bearer ${TOKEN}`);
    if (c.metodo === "POST") assert.equal(c.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.ok(!c.corpo.has("access_token"));
  }
}

function cliente(f: ReturnType<typeof fetchFalso>, esperas: number[] = []) {
  return criarClienteInstagram({
    token: TOKEN,
    fetch: f.fn,
    esperar: async (ms) => void esperas.push(ms),
    intervaloStatusMs: 5000,
    tetoStatusMs: 240_000,
  });
}

export default suite("Cliente da Instagram API (fetch falso)", (t) => {
  t("reel: cria container, espera FINISHED, publica e pega permalink", async () => {
    const f = fetchFalso([
      { json: { id: "C1" } },
      { json: { status_code: "IN_PROGRESS" } },
      { json: { status_code: "IN_PROGRESS" } },
      { json: { status_code: "FINISHED" } },
      { json: { id: "M1" } },
      { json: { permalink: "https://instagram.com/reel/abc" } },
    ]);
    const esperas: number[] = [];
    const r = await cliente(f, esperas).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "Oi\n\n#a", capaUrl: "https://x/c.jpg" });
    assert.deepEqual(r, { containerId: "C1", mediaId: "M1", permalink: "https://instagram.com/reel/abc" });
    const [criar, s1, , , pub, perm] = f.chamadas;
    assert.equal(criar.metodo, "POST");
    assert.equal(criar.url, `${BASE}/U1/media`);
    assert.equal(criar.corpo.get("media_type"), "REELS");
    assert.equal(criar.corpo.get("video_url"), "https://x/v.mp4");
    assert.equal(criar.corpo.get("caption"), "Oi\n\n#a");
    assert.equal(criar.corpo.get("share_to_feed"), "true");
    assert.equal(criar.corpo.get("cover_url"), "https://x/c.jpg");
    assert.equal(s1.url, `${BASE}/C1?fields=status_code%2Cstatus`);
    assert.equal(pub.url, `${BASE}/U1/media_publish`);
    assert.equal(pub.corpo.get("creation_id"), "C1");
    assert.equal(perm.url, `${BASE}/M1?fields=permalink`);
    assert.deepEqual(esperas, [5000, 5000]);
    semTokenNaUrl(f.chamadas);
  });

  t("reel sem capa não manda cover_url", async () => {
    const f = fetchFalso([{ json: { id: "C1" } }, { json: { status_code: "FINISHED" } }, { json: { id: "M1" } }, { json: { permalink: "p" } }]);
    await cliente(f).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "" });
    assert.equal(f.chamadas[0].corpo.has("cover_url"), false);
  });

  t("status ERROR falha com o detalhe", async () => {
    const f = fetchFalso([{ json: { id: "C1" } }, { json: { status_code: "ERROR", status: "Error: formato inválido" } }]);
    await assert.rejects(cliente(f).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "" }), /ERROR.*formato inválido/);
  });

  t("teto de 240 s esperando FINISHED", async () => {
    const respostas = [{ json: { id: "C1" } }, ...Array.from({ length: 60 }, () => ({ json: { status_code: "IN_PROGRESS" } }))];
    const f = fetchFalso(respostas);
    const esperas: number[] = [];
    await assert.rejects(cliente(f, esperas).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "" }), /240 s/);
    assert.equal(esperas.reduce((a, b) => a + b, 0), 240_000);
  });

  t("permalink que falha não derruba a publicação", async () => {
    const f = fetchFalso([
      { json: { id: "C1" } }, { json: { status_code: "FINISHED" } }, { json: { id: "M1" } },
      { status: 500, json: { error: { message: "boom" } } },
    ]);
    const r = await cliente(f).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "" });
    assert.equal(r.mediaId, "M1");
    assert.equal(r.permalink, null);
  });

  t("carrossel: filhos na ordem com alt_text, container CAROUSEL, espera e publica", async () => {
    const f = fetchFalso([
      { json: { id: "F1" } }, { json: { id: "F2" } }, { json: { id: "F3" } },
      { json: { id: "CC" } }, { json: { status_code: "FINISHED" } }, { json: { id: "M9" } }, { json: { permalink: "https://instagram.com/p/x" } },
    ]);
    const r = await cliente(f).publicarCarrossel("U1", { imagens: ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"], legenda: "L", altText: "Descrição" });
    assert.equal(r.mediaId, "M9");
    for (let i = 0; i < 3; i++) {
      assert.equal(f.chamadas[i].corpo.get("image_url"), `https://x/${i + 1}.jpg`);
      assert.equal(f.chamadas[i].corpo.get("is_carousel_item"), "true");
      assert.equal(f.chamadas[i].corpo.get("alt_text"), "Descrição");
    }
    assert.equal(f.chamadas[3].corpo.get("media_type"), "CAROUSEL");
    assert.equal(f.chamadas[3].corpo.get("children"), "F1,F2,F3");
    assert.equal(f.chamadas[3].corpo.get("caption"), "L");
    assert.equal(f.chamadas[5].url, `${BASE}/U1/media_publish`);
    semTokenNaUrl(f.chamadas);
  });

  t("carrossel: Meta recusa alt_text → refaz sem ele (e não insiste nos próximos)", async () => {
    const f = fetchFalso([
      { status: 400, json: { error: { message: "Invalid parameter alt_text", code: 100 } } },
      { json: { id: "F1" } },
      { json: { id: "F2" } },
      { json: { id: "CC" } }, { json: { status_code: "FINISHED" } }, { json: { id: "M1" } }, { json: { permalink: "p" } },
    ]);
    await cliente(f).publicarCarrossel("U1", { imagens: ["https://x/1.jpg", "https://x/2.jpg"], legenda: "", altText: "alt" });
    assert.equal(f.chamadas[0].corpo.get("alt_text"), "alt");
    assert.equal(f.chamadas[1].corpo.has("alt_text"), false);
    assert.equal(f.chamadas[2].corpo.has("alt_text"), false);
    assert.equal(f.chamadas[3].corpo.get("children"), "F1,F2");
  });

  t("token recusado (190) não tenta de novo sem alt_text", async () => {
    const f = fetchFalso([{ status: 400, json: { error: { message: "Error validating access token", code: 190 } } }]);
    await assert.rejects(
      cliente(f).publicarCarrossel("U1", { imagens: ["https://x/1.jpg", "https://x/2.jpg"], legenda: "", altText: "alt" }),
      (e: unknown) => e instanceof ErroInstagram && e.tokenRecusado,
    );
    assert.equal(f.chamadas.length, 1);
  });

  t("/me com campos completos; se falhar, só user_id e username", async () => {
    const f = fetchFalso([
      { status: 400, json: { error: { message: "Tried accessing nonexisting field (followers_count)", code: 100 } } },
      { json: { user_id: "17841", username: "cliente" } },
    ]);
    const p = await cliente(f).me();
    assert.equal(p.username, "cliente");
    assert.match(f.chamadas[0].url, /fields=user_id%2Cusername%2Cname%2Cprofile_picture_url%2Cfollowers_count%2Cmedia_count/);
    assert.equal(f.chamadas[1].url, `${BASE}/me?fields=user_id%2Cusername`);
    semTokenNaUrl(f.chamadas);
  });

  t("renovar token usa o header", async () => {
    const f = fetchFalso([{ json: { access_token: "NOVO", token_type: "bearer", expires_in: 5184000 } }]);
    const r = await cliente(f).renovarToken();
    assert.equal(r.access_token, "NOVO");
    assert.equal(f.chamadas[0].url, "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token");
    semTokenNaUrl(f.chamadas);
  });

  t("renovar: se o header não bastar, repete com o token na query (só nessa chamada)", async () => {
    const f = fetchFalso([
      { status: 400, json: { error: { message: "An active access token must be used", code: 2500 } } },
      { json: { access_token: "NOVO", expires_in: 5184000 } },
    ]);
    const r = await cliente(f).renovarToken();
    assert.equal(r.access_token, "NOVO");
    assert.equal(new URL(f.chamadas[1].url).searchParams.get("access_token"), TOKEN);
  });

  t("renovar: token vencido (190) não tenta de novo", async () => {
    const f = fetchFalso([{ status: 400, json: { error: { message: "Session has expired", code: 190 } } }]);
    await assert.rejects(cliente(f).renovarToken());
    assert.equal(f.chamadas.length, 1);
  });

  t("erro devolvido vem com token mascarado", async () => {
    const f = fetchFalso([{ status: 400, json: { error: { message: `bad request access_token=${TOKEN}`, code: 1 } } }]);
    await assert.rejects(cliente(f).publicarReel("U1", { videoUrl: "https://x/v.mp4", legenda: "" }), (e: unknown) => {
      const m = (e as Error).message;
      return !m.includes(TOKEN) && m.includes("access_token=***");
    });
  });
});
