import { assert, suite } from "./lib";
import { CORTE_MAIS, cortarNoMais, montarLegenda, normalizarHashtags } from "@/lib/regras/legenda";

export default suite("Legenda e hashtags", (t) => {
  t("normalizarHashtags tira #, espaços e repetidas", () => {
    assert.deepEqual(normalizarHashtags(["#marketing", "##Marketing", " vendas ", "#", "", "dica,extra"]), ["marketing", "vendas", "dica", "extra"]);
  });
  t("normalizarHashtags aceita string e acentos", () => {
    assert.deepEqual(normalizarHashtags("#educação #saúde! #educação"), ["educação", "saúde"]);
  });
  t("normalizarHashtags corta em 30", () => {
    const tags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
    assert.equal(normalizarHashtags(tags).length, 30);
  });
  t("normalizarHashtags vazio/nulo", () => {
    assert.deepEqual(normalizarHashtags(null), []);
    assert.deepEqual(normalizarHashtags([]), []);
  });
  t("montarLegenda junta descrição + linha em branco + hashtags", () => {
    assert.equal(montarLegenda("Olá mundo", ["a", "#b", "a"]), "Olá mundo\n\n#a #b");
  });
  t("montarLegenda sem hashtags devolve só a descrição", () => {
    assert.equal(montarLegenda("  Texto  ", []), "Texto");
  });
  t("montarLegenda só hashtags", () => {
    assert.equal(montarLegenda("", ["x"]), "#x");
  });
  t("montarLegenda: nunca passa de 2200 e no máximo 30 tags", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `hashtag${i}`);
    const leg = montarLegenda("a".repeat(2000), tags);
    assert.ok(leg.length <= 2200, `tamanho ${leg.length}`);
    const n = (leg.match(/#/g) ?? []).length;
    assert.ok(n <= 30);
    assert.ok(!/#\S*$/.test(leg) || leg.split(" ").pop()!.startsWith("#hashtag"), "não corta hashtag no meio");
    const curta = montarLegenda("oi", tags);
    assert.equal((curta.match(/#/g) ?? []).length, 30);
  });
  t("montarLegenda corta descrição gigante em 2200", () => {
    const leg = montarLegenda("b".repeat(3000), ["x"]);
    assert.equal(leg.length, 2200);
    assert.ok(!leg.includes("#"));
  });
  t("montarLegenda sem # duplicado", () => {
    assert.equal(montarLegenda("t", ["##a"]), "t\n\n#a");
  });
  t("corte de 125 caracteres", () => {
    assert.equal(CORTE_MAIS, 125);
    const texto = "x".repeat(130);
    const { visivel, resto } = cortarNoMais(texto);
    assert.equal(visivel.length, 125);
    assert.equal(resto.length, 5);
    assert.deepEqual(cortarNoMais("curto"), { visivel: "curto", resto: "" });
  });
  t("corte de 125 não quebra emoji", () => {
    const texto = "😀".repeat(126);
    const { visivel, resto } = cortarNoMais(texto);
    assert.equal(Array.from(visivel).length, 125);
    assert.equal(resto, "😀");
  });
});
