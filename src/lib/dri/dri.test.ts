// Testes do serviço de DRI. Valores vêm do dri_nutreai.json (não hardcodados
// no serviço); os asserts abaixo checam contra os números documentados no README.

import { describe, it, expect } from "vitest";
import {
  selecionarEstagio,
  getDRIs,
  avaliarIngestao,
  calcularEER,
} from "./dri";

describe("selecionarEstagio", () => {
  it("mapeia mulher 34 anos para f3150", () => {
    expect(selecionarEstagio("F", 34)).toBe("f3150");
  });

  it("mapeia homem 25 anos para m1930", () => {
    expect(selecionarEstagio("masculino", 25)).toBe("m1930");
  });

  it("lactente < 7 meses -> i06 e 7-12 meses -> i712", () => {
    expect(selecionarEstagio("F", 0.3)).toBe("i06"); // ~3,6 meses
    expect(selecionarEstagio("M", 0.8)).toBe("i712"); // ~9,6 meses
  });

  it("crianças: 1-3 -> c13 e 4-8 -> c48", () => {
    expect(selecionarEstagio("M", 2)).toBe("c13");
    expect(selecionarEstagio("F", 6)).toBe("c48");
  });

  it("gestante 28 anos -> p1930 e lactante 40 anos -> l3150", () => {
    expect(selecionarEstagio("F", 28, true, false)).toBe("p1930");
    expect(selecionarEstagio("F", 40, false, true)).toBe("l3150");
  });
});

describe("getDRIs", () => {
  it("ferro para mulher 31-50 = RDA 18, UL 45", () => {
    const refs = getDRIs({ sexo: "F", idadeAnos: 40 });
    const ferro = refs.find((r) => r.chave === "iron");
    expect(ferro).toBeDefined();
    expect(ferro?.type).toBe("RDA");
    expect(ferro?.rda_ai).toBe(18);
    expect(ferro?.ul).toBe(45);
  });

  it("vitamina C para homem 19-30 = RDA 90", () => {
    const refs = getDRIs({ sexo: "M", idadeAnos: 25 });
    const vitc = refs.find((r) => r.chave === "vitamin_c");
    expect(vitc).toBeDefined();
    expect(vitc?.type).toBe("RDA");
    expect(vitc?.rda_ai).toBe(90);
  });
});

describe("avaliarIngestao", () => {
  it("ferro abaixo do EAR -> abaixo_EAR", () => {
    // EAR do ferro em f3150 é 8,1 mg; 5 mg fica abaixo.
    const r = avaliarIngestao("iron", 5, "f3150");
    expect(r.classificacao).toBe("abaixo_EAR");
  });

  it("ferro na RDA -> adequado", () => {
    const r = avaliarIngestao("iron", 18, "f3150");
    expect(r.classificacao).toBe("adequado");
  });

  it("ferro no UL -> atencao_UL", () => {
    const r = avaliarIngestao("iron", 45, "f3150");
    expect(r.classificacao).toBe("atencao_UL");
  });

  it("ferro entre EAR e RDA -> intermediario", () => {
    const r = avaliarIngestao("iron", 12, "f3150");
    expect(r.classificacao).toBe("intermediario");
  });
});

describe("calcularEER", () => {
  it("mulher low_active, 22 anos, 165 cm, 63 kg ≈ 2275 kcal", () => {
    const r = calcularEER("F", 22, 63, 165, "low_active");
    expect(r.aplicavel).toBe(true);
    expect(r.eerKcal).not.toBeNull();
    // tolerância de arredondamento
    expect(Math.abs((r.eerKcal as number) - 2275)).toBeLessThanOrEqual(1);
  });

  it("< 19 anos retorna aviso e sem valor", () => {
    const r = calcularEER("M", 15, 55, 165, "active");
    expect(r.aplicavel).toBe(false);
    expect(r.eerKcal).toBeNull();
    expect(r.aviso).toBeTruthy();
  });

  it("gestante retorna aviso (deposição não incluída)", () => {
    const r = calcularEER("F", 30, 70, 165, "low_active", true);
    expect(r.aplicavel).toBe(false);
    expect(r.aviso).toBeTruthy();
  });

  it("PAL inválido lança erro", () => {
    // @ts-expect-error PAL fora do union
    expect(() => calcularEER("M", 30, 80, 178, "moderado")).toThrow();
  });
});
