import { assert, suite } from "./lib";
import { erroEmLinguagemHumana, mascararMensagem, statusAposFalha, validarParaPublicar } from "@/lib/regras/publicacao";

export default suite("Regras de publicação", (t) => {
  t("statusAposFalha: 1ª e 2ª voltam para agendado, 3ª vira erro", () => {
    assert.deepEqual(statusAposFalha(0), { status: "agendado", tentativas: 1 });
    assert.deepEqual(statusAposFalha(1), { status: "agendado", tentativas: 2 });
    assert.deepEqual(statusAposFalha(2), { status: "erro", tentativas: 3 });
    assert.deepEqual(statusAposFalha(5), { status: "erro", tentativas: 6 });
  });
  t("mascara access_token na URL e no JSON", () => {
    const m = mascararMensagem("GET https://graph.instagram.com/x?access_token=IGQVJabc123&foo=1 falhou; {\"access_token\":\"IGQ999\"}");
    assert.ok(!m.includes("IGQVJabc123"));
    assert.ok(!m.includes("IGQ999"));
    assert.ok(m.includes("access_token=***"));
  });
  t("mascara Bearer e o próprio token", () => {
    const token = "IGAAsupersecreto123456";
    const m = mascararMensagem(`Authorization: Bearer ${token} e de novo ${token}`, token);
    assert.ok(!m.includes(token));
  });
  t("mensagem cortada em 500", () => {
    assert.equal(mascararMensagem("x".repeat(900)).length, 500);
  });
  t("aceita Error", () => {
    assert.equal(mascararMensagem(new Error("falhou access_token=abc")), "falhou access_token=***");
  });
  t("validação: reel com exatamente 1 vídeo https", () => {
    assert.equal(validarParaPublicar({ tipo: "reel", midia_urls: ["https://x/v.mp4"], capa_url: null }), null);
    assert.ok(validarParaPublicar({ tipo: "reel", midia_urls: ["https://x/a.mp4", "https://x/b.mp4"], capa_url: null }));
    assert.ok(validarParaPublicar({ tipo: "reel", midia_urls: [], capa_url: null }));
  });
  t("validação: carrossel com 2 a 10 imagens", () => {
    const img = (n: number) => Array.from({ length: n }, (_, i) => `https://x/${i}.jpg`);
    assert.ok(validarParaPublicar({ tipo: "carrossel", midia_urls: img(1), capa_url: null }));
    assert.equal(validarParaPublicar({ tipo: "carrossel", midia_urls: img(2), capa_url: null }), null);
    assert.equal(validarParaPublicar({ tipo: "carrossel", midia_urls: img(10), capa_url: null }), null);
    assert.ok(validarParaPublicar({ tipo: "carrossel", midia_urls: img(11), capa_url: null }));
  });
  t("validação: recusa http:// e capa sem https", () => {
    assert.ok(validarParaPublicar({ tipo: "reel", midia_urls: ["http://x/v.mp4"], capa_url: null }));
    assert.ok(validarParaPublicar({ tipo: "reel", midia_urls: ["https://x/v.mp4"], capa_url: "ftp://x/c.jpg" }));
  });
  t("erro em linguagem humana: token vencido", () => {
    assert.match(erroEmLinguagemHumana("Error validating access token: Session has expired (code 190)")!, /Conexões/);
    assert.equal(erroEmLinguagemHumana(null), null);
  });
});
