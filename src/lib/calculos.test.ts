import { describe, it, expect } from "vitest";
import {
  calcularTmb,
  calcularGet,
  calcularMetaCalorica,
  calcularImc,
  classificarImc,
  estimarPercentualGordura,
  calcularMme,
  calcularProteinaG,
  calcularMacros,
  somaKcalMacros,
  calcularAguaLitros,
  calcularPerfilMetabolico,
  calcularIndiceProgressao,
  avaliarEvolucaoFisica,
} from "./calculos";

describe("TMB — Mifflin-St Jeor", () => {
  it("caso de referência: homem 35a, 90kg, 175cm → 1824 kcal (1823,75)", () => {
    const tmb = calcularTmb("masculino", 90, 175, 35);
    expect(tmb).toBeCloseTo(1823.75, 2);
    expect(Math.round(tmb)).toBe(1824);
  });

  it("mulher 30a, 65kg, 160cm → 10*65 + 6,25*160 - 5*30 - 161 = 1339", () => {
    expect(calcularTmb("feminino", 65, 160, 30)).toBeCloseTo(1339, 2);
  });
});

describe("GET e meta calórica", () => {
  const tmb = calcularTmb("masculino", 90, 175, 35); // 1823.75

  it("GET com fator 1,375 → ≈2508 kcal", () => {
    const get = calcularGet(tmb, 1.375);
    expect(Math.round(get)).toBe(2508); // 2507.65...
  });

  it("meta emagrecimento -20% → ≈2006 kcal", () => {
    const get = calcularGet(tmb, 1.375);
    const meta = calcularMetaCalorica("emagrecimento", get, tmb);
    expect(Math.round(meta)).toBe(2006);
  });

  it("meta de emagrecimento nunca fica abaixo da TMB", () => {
    // sedentário: GET = TMB*1.2; déficit de 25% levaria abaixo da TMB → clamp
    const tmbLocal = 2000;
    const get = 2400;
    const meta = calcularMetaCalorica("emagrecimento", get, tmbLocal, { deficit: 0.25 });
    expect(meta).toBeGreaterThanOrEqual(tmbLocal);
    expect(meta).toBe(2000);
  });

  it("ganho de massa: GET + 300 a 500 (padrão 400)", () => {
    expect(calcularMetaCalorica("ganho", 2500, 1800)).toBe(2900);
    expect(calcularMetaCalorica("ganho", 2500, 1800, { superavitGanho: 300 })).toBe(2800);
  });

  it("manutenção: meta = GET; performance: GET + 300", () => {
    expect(calcularMetaCalorica("manutencao", 2500, 1800)).toBe(2500);
    expect(calcularMetaCalorica("performance", 2500, 1800)).toBe(2800);
  });
});

describe("IMC e classificação", () => {
  it("90kg / 175cm → IMC 29,4 (sobrepeso)", () => {
    const imc = calcularImc(90, 175);
    expect(imc).toBeCloseTo(29.39, 1);
    expect(classificarImc(imc)).toBe("sobrepeso");
  });

  it("classificações nos limites", () => {
    expect(classificarImc(18.4)).toBe("baixo peso");
    expect(classificarImc(18.5)).toBe("eutrofia");
    expect(classificarImc(25)).toBe("sobrepeso");
    expect(classificarImc(30)).toBe("obesidade grau I");
    expect(classificarImc(35)).toBe("obesidade grau II");
    expect(classificarImc(40)).toBe("obesidade grau III");
  });
});

describe("MME e proteína para IMC >= 30", () => {
  it("%G estimado por faixa de IMC e sexo (faixa mais baixa, a favor do paciente)", () => {
    expect(estimarPercentualGordura(29.9, "masculino")).toBeNull();
    expect(estimarPercentualGordura(32, "masculino")).toBe(0.28);
    expect(estimarPercentualGordura(32, "feminino")).toBe(0.38);
    expect(estimarPercentualGordura(37, "masculino")).toBe(0.33);
    expect(estimarPercentualGordura(37, "feminino")).toBe(0.43);
    expect(estimarPercentualGordura(42, "masculino")).toBe(0.38);
    expect(estimarPercentualGordura(42, "feminino")).toBe(0.48);
  });

  it("MME = peso × (1 − %G): 110kg com 28% → 79,2kg", () => {
    expect(calcularMme(110, 0.28)).toBeCloseTo(79.2, 5);
  });

  it("IMC >= 30: proteína 2,0 g/kg de MME; IMC < 30: 1,8 g/kg de peso", () => {
    // homem 110kg, 180cm → IMC 33,95 → %G 28% → MME 79,2 → 158g
    const imcObeso = calcularImc(110, 180);
    const obeso = calcularProteinaG(110, imcObeso, "masculino");
    expect(obeso.mmeKg).toBeCloseTo(79.2, 1);
    expect(obeso.proteinaG).toBe(158);

    const naoObeso = calcularProteinaG(90, calcularImc(90, 175), "masculino");
    expect(naoObeso.mmeKg).toBeNull();
    expect(naoObeso.proteinaG).toBe(162); // 90 × 1,8
  });
});

describe("Macros — soma bate com a meta (±2%)", () => {
  const casos = [
    { objetivo: "emagrecimento", peso: 90, altura: 175, sexo: "masculino", meta: 2006 },
    { objetivo: "ganho", peso: 70, altura: 178, sexo: "masculino", meta: 3000 },
    { objetivo: "manutencao", peso: 65, altura: 160, sexo: "feminino", meta: 2000 },
    { objetivo: "performance", peso: 80, altura: 182, sexo: "masculino", meta: 3200 },
    { objetivo: "emagrecimento", peso: 110, altura: 180, sexo: "masculino", meta: 2200 },
  ] as const;

  for (const c of casos) {
    it(`${c.objetivo} ${c.peso}kg → soma dos macros = meta ±2%`, () => {
      const imc = calcularImc(c.peso, c.altura);
      const { macros } = calcularMacros(c.objetivo, c.meta, c.peso, imc, c.sexo);
      const soma = somaKcalMacros(macros);
      expect(Math.abs(soma - c.meta) / c.meta).toBeLessThanOrEqual(0.02);
      expect(macros.proteinaG).toBeGreaterThan(0);
      expect(macros.carboidratoG).toBeGreaterThan(0);
      expect(macros.gorduraG).toBeGreaterThan(0);
    });
  }

  it("ganho: gordura nunca abaixo de 20% da meta", () => {
    const imc = calcularImc(60, 170);
    const { macros } = calcularMacros("ganho", 2400, 60, imc, "masculino");
    expect(macros.gorduraG * 9).toBeGreaterThanOrEqual(2400 * 0.2 * 0.95);
  });
});

describe("Hidratação", () => {
  it("35 ml/kg: 70kg → 2,5 L", () => {
    expect(calcularAguaLitros(70)).toBe(2.5);
  });
  it("teto prático de 4 L: 130kg → 4 L", () => {
    expect(calcularAguaLitros(130)).toBe(4);
  });
  it("+500 ml por hora de treino intenso", () => {
    expect(calcularAguaLitros(70, 1)).toBe(3);
  });
});

describe("Perfil metabólico completo", () => {
  it("caso de referência integrado: homem 35a/90kg/175cm/1,375 emagrecimento", () => {
    const p = calcularPerfilMetabolico({
      sexo: "masculino",
      idade: 35,
      pesoKg: 90,
      alturaCm: 175,
      fatorAtividade: 1.375,
      objetivo: "emagrecimento",
    });
    expect(p.tmb).toBe(1824);
    expect(p.get).toBe(2508);
    expect(p.metaCalorica).toBe(2006);
    expect(p.imc).toBe(29.4);
    expect(p.classificacaoImc).toBe("sobrepeso");
    expect(p.mmeKg).toBeNull();
    expect(p.aguaLitros).toBe(3.2); // 90*35=3150ml → 3,2 (arredondado)
    expect(p.abaixoDoPisoCalorico).toBe(false);
    const soma = somaKcalMacros(p.macros);
    expect(Math.abs(soma - p.metaCalorica) / p.metaCalorica).toBeLessThanOrEqual(0.02);
  });

  it("sinaliza meta abaixo do piso calórico (mulher <1200)", () => {
    const p = calcularPerfilMetabolico({
      sexo: "feminino",
      idade: 60,
      pesoKg: 45,
      alturaCm: 150,
      fatorAtividade: 1.2,
      objetivo: "emagrecimento",
    });
    // TMB = 450+937,5-300-161 = 926,5; GET = 1111,8; meta clampada na TMB = 926,5... < 1200
    expect(p.abaixoDoPisoCalorico).toBe(true);
  });
});

describe("Índice de progressão (40% adesão + 40% evolução + 20% consistência)", () => {
  it("tudo máximo → 10", () => {
    expect(calcularIndiceProgressao(10, 10, 2, 2)).toBe(10);
  });
  it("adesão 8, evolução 7, 1 de 2 check-ins → 0,4*8 + 0,4*7 + 0,2*5 = 7", () => {
    expect(calcularIndiceProgressao(8, 7, 1, 2)).toBe(7);
  });
  it("risco de abandono: adesão 2, evolução 3, 0 check-ins → 2", () => {
    expect(calcularIndiceProgressao(2, 3, 0, 2)).toBe(2);
  });
});

describe("Avaliação de evolução física", () => {
  it("emagrecimento no ritmo esperado (0,5–1%/semana) → 10", () => {
    // 90kg inicial; perdeu 0,6kg em 1 semana (0,67%)
    expect(avaliarEvolucaoFisica("emagrecimento", 90, 88, 87.4, 1)).toBe(10);
  });
  it("perda rápida demais (>1%/semana) → 6 (atenção)", () => {
    expect(avaliarEvolucaoFisica("emagrecimento", 90, 88, 86.5, 1)).toBe(6);
  });
  it("ganho de peso no emagrecimento → 3", () => {
    expect(avaliarEvolucaoFisica("emagrecimento", 90, 88, 89, 1)).toBe(3);
  });
});
