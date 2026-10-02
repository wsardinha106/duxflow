import { assert, suite } from "./lib";
import {
  chaveDia, deBrasilia, deInputLocal, formatarDataHora, gradeMes, gradeSemana, instanteDoSlot,
  intervaloUtc, paraInputLocal, slotJaPassou, somarDias,
} from "@/lib/regras/datas";

export default suite("Datas em Brasília e grades", (t) => {
  t("deBrasilia converte para UTC (UTC-3)", () => {
    assert.equal(deBrasilia(2026, 3, 10, 6, 0).toISOString(), "2026-03-10T09:00:00.000Z");
  });
  t("virada de dia em UTC: 22:30 em Brasília é o dia seguinte em UTC", () => {
    const d = deBrasilia(2026, 3, 10, 22, 30);
    assert.equal(d.toISOString(), "2026-03-11T01:30:00.000Z");
    assert.equal(chaveDia(d), "2026-03-10");
    assert.equal(formatarDataHora(d), "10/03/2026 22:30");
  });
  t("chaveDia usa Brasília, não UTC", () => {
    assert.equal(chaveDia("2026-03-11T02:00:00Z"), "2026-03-10");
    assert.equal(chaveDia("2026-03-11T03:00:00Z"), "2026-03-11");
  });
  t("formato dd/mm/aaaa hh:mm", () => {
    assert.equal(formatarDataHora("2026-01-05T18:00:00Z"), "05/01/2026 15:00");
    assert.equal(formatarDataHora(null), "—");
  });
  t("input datetime-local ida e volta", () => {
    assert.equal(paraInputLocal("2026-03-11T01:30:00Z"), "2026-03-10T22:30");
    assert.equal(deInputLocal("2026-03-10T22:30").toISOString(), "2026-03-11T01:30:00.000Z");
    assert.throws(() => deInputLocal("lixo"));
  });
  t("instante do slot (reel 06:00, carrossel 15:00)", () => {
    assert.equal(instanteDoSlot("reel", "2026-03-10").toISOString(), "2026-03-10T09:00:00.000Z");
    assert.equal(instanteDoSlot("carrossel", "2026-03-10").toISOString(), "2026-03-10T18:00:00.000Z");
  });
  t("slot de hoje já passou — em Brasília", () => {
    // 08:30 UTC = 05:30 Brasília: reel das 06:00 ainda não passou
    assert.equal(slotJaPassou("reel", "2026-03-10", new Date("2026-03-10T08:30:00Z")), false);
    assert.equal(slotJaPassou("reel", "2026-03-10", new Date("2026-03-10T09:00:00Z")), true);
    // 02:00 UTC do dia 11 ainda é dia 10 em Brasília (23:00)
    assert.equal(slotJaPassou("carrossel", "2026-03-11", new Date("2026-03-11T02:00:00Z")), false);
  });
  t("somarDias atravessa mês e ano", () => {
    assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
    assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  });
  t("grade do mês: semanas completas, domingo a sábado", () => {
    const g = gradeMes(2026, 3); // março/2026 começa num domingo
    assert.equal(g.length % 7, 0);
    assert.equal(g[0].chave, "2026-03-01");
    assert.equal(g.filter((d) => d.doMes).length, 31);
    const fev = gradeMes(2026, 2); // fev/2026: 1º é domingo, 28 dias
    assert.equal(fev.length, 28);
    const out = gradeMes(2026, 10); // out/2026: 1º é quinta
    assert.equal(out[0].chave, "2026-09-27");
    assert.equal(out[0].doMes, false);
    assert.equal(out.length, 35);
  });
  t("grade da semana", () => {
    assert.deepEqual(gradeSemana("2026-10-02"), [
      "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
    ]);
  });
  t("intervalo UTC cobre o último dia inteiro", () => {
    const i = intervaloUtc("2026-03-01", "2026-03-31");
    assert.equal(i.de, "2026-03-01T03:00:00.000Z");
    assert.equal(i.ate, "2026-04-01T03:00:00.000Z");
  });
});
