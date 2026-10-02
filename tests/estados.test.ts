import { assert, suite } from "./lib";
import { acoesPermitidas, podeExecutar, statusApos, statusQuePermitem, type Acao } from "@/lib/regras/estados";
import type { Status } from "@/lib/tipos";

const TODAS: Acao[] = ["aprovar", "descartar", "editar", "publicar_agora", "voltar_pendente", "tentar_de_novo"];
const ESPERADO: Record<Status, Acao[]> = {
  pendente: ["aprovar", "descartar", "editar", "publicar_agora"],
  agendado: ["descartar", "editar", "publicar_agora", "voltar_pendente"],
  erro: ["tentar_de_novo", "descartar", "editar", "publicar_agora"],
  publicando: [],
  publicado: [],
  descartado: ["voltar_pendente"],
};

export default suite("Máquina de estados (§7)", (t) => {
  for (const [status, acoes] of Object.entries(ESPERADO) as [Status, Acao[]][]) {
    t(`${status}: permite exatamente ${acoes.join(", ") || "nada"}`, () => {
      assert.deepEqual([...acoesPermitidas(status)].sort(), [...acoes].sort());
      for (const a of TODAS) assert.equal(podeExecutar(status, a), acoes.includes(a), `${status} × ${a}`);
    });
  }

  t("transições resultantes", () => {
    assert.equal(statusApos("pendente", "aprovar"), "agendado");
    assert.equal(statusApos("agendado", "voltar_pendente"), "pendente");
    assert.equal(statusApos("erro", "tentar_de_novo"), "agendado");
    assert.equal(statusApos("pendente", "descartar"), "descartado");
    assert.equal(statusApos("descartado", "voltar_pendente"), "pendente");
    assert.equal(statusApos("erro", "publicar_agora"), "publicando");
    assert.equal(statusApos("agendado", "editar"), "agendado");
  });

  t("transições proibidas lançam erro", () => {
    assert.throws(() => statusApos("publicado", "descartar"));
    assert.throws(() => statusApos("publicado", "editar"));
    assert.throws(() => statusApos("publicando", "publicar_agora"));
    assert.throws(() => statusApos("agendado", "aprovar"));
    assert.throws(() => statusApos("pendente", "tentar_de_novo"));
    assert.throws(() => statusApos("descartado", "aprovar"));
    assert.throws(() => statusApos("pendente", "voltar_pendente"));
  });

  t("statusQuePermitem (filtro do UPDATE)", () => {
    assert.deepEqual(statusQuePermitem("publicar_agora").sort(), ["agendado", "erro", "pendente"]);
    assert.deepEqual(statusQuePermitem("aprovar"), ["pendente"]);
    assert.ok(!statusQuePermitem("descartar").includes("publicado"));
  });
});
