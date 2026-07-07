import { describe, it, expect } from "vitest";
import {
  validarDieta,
  encontrarTermosProibidos,
  extrairMetaDoTexto,
} from "./validador";

const dietaOk = `*PLANO ALIMENTAR PERSONALIZADO*
*PERFIL METABÓLICO*
TMB: 1824 kcal
Gasto Total Estimado: 2508 kcal
Meta Calórica: 2006 kcal (emagrecimento)
Proteínas: 162g | Carboidratos: 214g | Gorduras: 56g
Água: 3,2 L/dia`;

const base = {
  tmb: 1824,
  metaCalorica: 2006,
  macros: { proteinaG: 162, carboidratoG: 214, gorduraG: 56 }, // 648+856+504 = 2008 kcal
  textoDieta: dietaOk,
  sexo: "masculino" as const,
};

describe("validarDieta", () => {
  it("dieta válida passa", () => {
    const r = validarDieta(base);
    expect(r.erros).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("BLOQUEIA meta calórica abaixo da TMB (critério de aceite)", () => {
    const r = validarDieta({
      ...base,
      metaCalorica: 1500,
      textoDieta: dietaOk.replace("Meta Calórica: 2006", "Meta Calórica: 1500"),
      macros: { proteinaG: 120, carboidratoG: 130, gorduraG: 56 }, // ~1504 kcal
    });
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes("abaixo da TMB"))).toBe(true);
  });

  it("bloqueia soma de macros fora de ±2%", () => {
    const r = validarDieta({
      ...base,
      macros: { proteinaG: 100, carboidratoG: 100, gorduraG: 30 }, // 1070 kcal ≠ 2006
    });
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes("±2%"))).toBe(true);
  });

  it("bloqueia termos proibidos, incluindo variações de caixa e acento", () => {
    for (const termo of ["detox", "Detox", "SECAR", "queimar gordura", "acelerar o metabolismo… não, acelerar metabolismo", "desinchar", "turbinar"]) {
      const r = validarDieta({ ...base, textoDieta: `${dietaOk}\nDica: ${termo} agora!` });
      expect(r.ok, `deveria bloquear "${termo}"`).toBe(false);
    }
  });

  it("não dá falso positivo em palavras contendo os termos", () => {
    // "ressecar" contém "secar" mas com \b não casa no início da palavra
    const r = validarDieta({
      ...base,
      textoDieta: `${dietaOk}\nEvite deixar o frango ressecado ao assar.`,
    });
    expect(r.ok).toBe(true);
  });

  it("bloqueia quando meta declarada no texto difere da calculada", () => {
    const r = validarDieta({
      ...base,
      textoDieta: dietaOk.replace("Meta Calórica: 2006", "Meta Calórica: 1700"),
    });
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes("difere da calculada"))).toBe(true);
  });

  it("bloqueia quando meta não está declarada no texto", () => {
    const r = validarDieta({ ...base, textoDieta: "plano sem perfil metabólico" });
    expect(r.ok).toBe(false);
  });

  it("aviso (não bloqueio) para meta abaixo do piso calórico", () => {
    const r = validarDieta({
      ...base,
      sexo: "feminino",
      tmb: 1100,
      metaCalorica: 1150,
      macros: { proteinaG: 90, carboidratoG: 110, gorduraG: 39 }, // 1151 kcal ≈ 1150
      textoDieta: dietaOk.replace("Meta Calórica: 2006", "Meta Calórica: 1150"),
    });
    expect(r.avisos.some((a) => a.includes("piso"))).toBe(true);
  });
});

describe("helpers", () => {
  it("extrai meta com pontuação brasileira", () => {
    expect(extrairMetaDoTexto("Meta Calórica: 2.006 kcal")).toBe(2006);
    expect(extrairMetaDoTexto("Meta calorica: 1824 kcal")).toBe(1824);
    expect(extrairMetaDoTexto("sem meta aqui")).toBeNull();
  });

  it("encontra termos com acentos normalizados", () => {
    expect(encontrarTermosProibidos("plano détox para você")).toContain("detox");
    expect(encontrarTermosProibidos("plano equilibrado")).toEqual([]);
  });
});
