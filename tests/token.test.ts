import { assert, suite } from "./lib";
import { deveRenovar } from "@/lib/regras/token";

const agora = new Date("2026-03-10T12:00:00Z");

export default suite("Renovação do token", (t) => {
  t("nunca renovou → renova", () => {
    assert.equal(deveRenovar(null, agora), true);
    assert.equal(deveRenovar(undefined, agora), true);
    assert.equal(deveRenovar("", agora), true);
  });
  t("menos de 24h → não renova", () => {
    assert.equal(deveRenovar("2026-03-09T12:00:01Z", agora), false);
    assert.equal(deveRenovar("2026-03-10T11:00:00Z", agora), false);
  });
  t("24h ou mais → renova", () => {
    assert.equal(deveRenovar("2026-03-09T12:00:00Z", agora), true);
    assert.equal(deveRenovar("2026-01-01T00:00:00Z", agora), true);
  });
  t("data inválida → renova", () => {
    assert.equal(deveRenovar("ontem", agora), true);
  });
});
