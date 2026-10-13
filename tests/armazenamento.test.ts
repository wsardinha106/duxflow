import { assert, suite } from "./lib";
import { arquivosParaApagar, caminhoNoBucket } from "@/lib/regras/armazenamento";

const base = "https://abc.supabase.co/storage/v1/object/public/conteudos-instagram/";

export default suite("Limpeza do Storage após publicar", (t) => {
  t("caminhoNoBucket extrai o caminho e decodifica", () => {
    assert.equal(caminhoNoBucket(`${base}2026/10/ia-gestao-060000/video.mp4`), "2026/10/ia-gestao-060000/video.mp4");
    assert.equal(caminhoNoBucket(`${base}2026/10/a%20b/01.jpg?t=1`), "2026/10/a b/01.jpg");
  });
  t("URL de fora do bucket ou vazia não é apagada", () => {
    assert.equal(caminhoNoBucket("https://cdn.exemplo.com/video.mp4"), null);
    assert.equal(caminhoNoBucket("https://abc.supabase.co/storage/v1/object/public/outro-bucket/x.mp4"), null);
    assert.equal(caminhoNoBucket(null), null);
  });
  t("reel: apaga o vídeo e mantém a capa", () => {
    const r = arquivosParaApagar({ tipo: "reel", midia_urls: [`${base}p/video.mp4`], capa_url: `${base}p/capa.jpg` });
    assert.deepEqual(r, ["p/video.mp4"]);
  });
  t("carrossel: apaga as fotos e mantém a 1ª (miniatura)", () => {
    const r = arquivosParaApagar({ tipo: "carrossel", midia_urls: [`${base}p/01.jpg`, `${base}p/02.jpg`, `${base}p/03.jpg`], capa_url: null });
    assert.deepEqual(r, ["p/02.jpg", "p/03.jpg"]);
  });
  t("mídia hospedada fora do bucket fica de fora", () => {
    assert.deepEqual(arquivosParaApagar({ tipo: "reel", midia_urls: ["https://cdn.exemplo.com/v.mp4"], capa_url: null }), []);
  });
});
