import { describe, it, expect } from "vitest";
import { extrairEventos } from "./eventos";

describe("extrairEventos — alerta_substituicao", () => {
  it("extrai o alerta e o REMOVE do texto que o paciente lê", () => {
    const bruto = `Já pode seguir com a maçã; vou confirmar com o nutricionista. 💛

<<<NUTRE_EVENTO:alerta_substituicao>>>
{"refeicao":"café da manhã 7h30","alimentoOriginal":"banana prata 70g","sugerido":"maçã 100g","motivo":"menor potássio (DRC + Losartana)","nivel":"C","confianca":"media"}
<<<FIM_NUTRE_EVENTO>>>`;
    const { textoLimpo, eventos } = extrairEventos(bruto);

    expect(textoLimpo).not.toContain("NUTRE_EVENTO");
    expect(textoLimpo).not.toContain("nivel");
    expect(textoLimpo).toContain("maçã");

    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe("alerta_substituicao");
    expect(eventos[0].payload.nivel).toBe("C");
    expect(eventos[0].payload.sugerido).toBe("maçã 100g");
  });

  it("tolera fences de código em volta do JSON do alerta", () => {
    const bruto = "ok\n<<<NUTRE_EVENTO:alerta_substituicao>>>\n```json\n{\"nivel\":\"C\"}\n```\n<<<FIM_NUTRE_EVENTO>>>";
    const { eventos } = extrairEventos(bruto);
    expect(eventos[0].payload.nivel).toBe("C");
  });

  it("ignora tipo de evento desconhecido", () => {
    const { eventos } = extrairEventos(
      "x <<<NUTRE_EVENTO:tipo_invalido>>>{}<<<FIM_NUTRE_EVENTO>>>"
    );
    expect(eventos).toHaveLength(0);
  });
});
