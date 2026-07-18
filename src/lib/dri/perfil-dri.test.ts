// Testes da orquestração DRI ↔ pipeline: faixa clínica, PAL, política de energia
// (adulto = Mifflin; idoso/criança = EER da DRI) e bloco de micronutrientes.

import { describe, it, expect } from "vitest";
import {
  faixaClinica,
  palDeFator,
  resolverEnergia,
  montarBlocoDri,
} from "./perfil-dri";

describe("faixaClinica", () => {
  it("18 anos = criança/adolescente; 19 e 59 = adulto; 60 = idoso", () => {
    expect(faixaClinica(18)).toBe("crianca_adolescente");
    expect(faixaClinica(19)).toBe("adulto");
    expect(faixaClinica(59)).toBe("adulto");
    expect(faixaClinica(60)).toBe("idoso");
  });
});

describe("palDeFator", () => {
  it("mapeia fatores de atividade para PAL da DRI", () => {
    expect(palDeFator(1.2)).toBe("inactive");
    expect(palDeFator(1.375)).toBe("low_active");
    expect(palDeFator(1.55)).toBe("active");
    expect(palDeFator(1.725)).toBe("very_active");
    expect(palDeFator(1.9)).toBe("very_active");
  });
});

describe("resolverEnergia — política de energia", () => {
  it("adulto (30a) mantém Mifflin GET, sem valor de EER", () => {
    const r = resolverEnergia({
      sexo: "feminino",
      idadeAnos: 30,
      pesoKg: 63,
      alturaCm: 165,
      fatorAtividade: 1.375,
    });
    expect(r.faixa).toBe("adulto");
    expect(r.metodo).toBe("mifflin_get");
    expect(r.eerKcal).toBeNull();
  });

  it("idoso (65a) usa EER adulto da DRI", () => {
    // mulher low_active: 575,77 - 7,01*65 + 6,6*165 + 12,14*63 ≈ 1974
    const r = resolverEnergia({
      sexo: "feminino",
      idadeAnos: 65,
      pesoKg: 63,
      alturaCm: 165,
      fatorAtividade: 1.375,
    });
    expect(r.faixa).toBe("idoso");
    expect(r.metodo).toBe("eer_dri");
    expect(r.eerKcal).not.toBeNull();
    expect(Math.abs((r.eerKcal as number) - 1974)).toBeLessThanOrEqual(1);
  });

  it("criança/adolescente (15a) usa EER infantil + aviso de deposição", () => {
    // menino low_active: 19,12 + 3,68*15 + 8,62*170 + 20,28*60 ≈ 2757
    const r = resolverEnergia({
      sexo: "masculino",
      idadeAnos: 15,
      pesoKg: 60,
      alturaCm: 170,
      fatorAtividade: 1.375,
    });
    expect(r.faixa).toBe("crianca_adolescente");
    expect(r.metodo).toBe("eer_dri");
    expect(Math.abs((r.eerKcal as number) - 2757)).toBeLessThanOrEqual(1);
    expect(r.aviso).toBeTruthy();
  });

  it("criança fora de 3-18 cai no Mifflin com aviso", () => {
    const r = resolverEnergia({
      sexo: "feminino",
      idadeAnos: 2,
      pesoKg: 12,
      alturaCm: 85,
      fatorAtividade: 1.2,
    });
    expect(r.faixa).toBe("crianca_adolescente");
    expect(r.metodo).toBe("mifflin_get");
    expect(r.aviso).toBeTruthy();
  });
});

describe("montarBlocoDri", () => {
  it("traz micronutrientes do estágio e exclui os macros do sistema", () => {
    const bloco = montarBlocoDri({ sexo: "feminino", idadeAnos: 40 });
    expect(bloco).toContain("f3150");
    expect(bloco).toContain("Ferro"); // micronutriente presente
    expect(bloco).toContain("18 (RDA)"); // RDA de ferro em f3150
    // proteína/carboidrato/gordura/água NÃO entram (vêm do cálculo do sistema)
    expect(bloco).not.toContain("Proteína");
    expect(bloco).not.toContain("Carboidrato");
  });
});
