import { describe, it, expect } from "vitest";
import { extrairFiltros, montarBlocoFiltros } from "./substituicao";

// Ficha mínima de paciente saudável (só comportamento).
const saudavel = {
  objetivo: "manutencao",
  comportamento: {
    preferencias: ["frango", "arroz"],
    alimentosQueGosta: ["banana"],
    alimentosQueNaoGosta: ["jiló"],
    intolerancias: [],
    restricoes: [],
    orcamento: "econômico",
    tempoPreparoMin: 20,
    cozinha: true,
  },
  saude: { diagnosticos: [], medicacoes: [] },
};

// Paciente com DRC estágio 4 + hipertensão + losartana.
const clinico = {
  objetivo: "manutencao",
  comportamento: {
    intolerancias: ["lactose"],
    restricoes: [],
    alimentosQueNaoGosta: ["fígado"],
    preferencias: ["feijão"],
    orcamento: "médio",
  },
  saude: {
    diagnosticos: ["doença renal crônica estágio 4", "hipertensão"],
    medicacoes: ["losartana 50mg"],
  },
};

const celiaco = {
  objetivo: "emagrecimento",
  comportamento: { intolerancias: [], restricoes: ["doença celíaca"] },
  saude: { diagnosticos: ["doença celíaca"], medicacoes: [] },
};

describe("extrairFiltros", () => {
  it("captura preferências e aversões do paciente saudável, sem trava clínica", () => {
    const f = extrairFiltros(saudavel);
    expect(f.temTravaClinica).toBe(false);
    expect(f.aversoes).toContain("jiló");
    expect(f.preferencias).toContain("frango");
    expect(f.vetosClinicos).toEqual([]);
    expect(f.tetosClinicos).toEqual([]);
  });

  it("marca intolerância à lactose como veto absoluto", () => {
    const f = extrairFiltros(clinico);
    expect(f.alergiasIntolerancias).toContain("lactose");
  });

  it("herda vetos e tetos clínicos da DRC (potássio/fósforo/proteína)", () => {
    const f = extrairFiltros(clinico);
    expect(f.temTravaClinica).toBe(true);
    const tetos = f.tetosClinicos.join(" ").toLowerCase();
    expect(tetos).toContain("potassio");
    expect(tetos).toContain("fosforo");
    expect(tetos).toContain("proteina");
    // veto de sódio vem da HAS/DRC
    expect(f.vetosClinicos.join(" ").toLowerCase()).toContain("sodio");
  });

  it("detecta interação fármaco-nutriente da losartana", () => {
    const f = extrairFiltros(clinico);
    expect(f.interacoesFarmaco.length).toBeGreaterThan(0);
    expect(f.interacoesFarmaco.join(" ").toLowerCase()).toContain("potassio");
  });

  it("celíaco entra como trava clínica com veto de glúten", () => {
    const f = extrairFiltros(celiaco);
    expect(f.temTravaClinica).toBe(true);
    const texto = (f.vetosClinicos.join(" ") + f.tetosClinicos.join(" ")).toLowerCase();
    expect(texto).toContain("gluten");
  });

  it("não quebra com anamnese vazia", () => {
    const f = extrairFiltros({});
    expect(f.temTravaClinica).toBe(false);
    expect(f.alergiasIntolerancias).toEqual([]);
  });
});

describe("montarBlocoFiltros", () => {
  it("gera cabeçalho e seções de preferência para paciente saudável", () => {
    const bloco = montarBlocoFiltros(saudavel);
    expect(bloco).toContain("FILTROS DE SUBSTITUIÇÃO ATIVOS");
    expect(bloco).toContain("Preferências");
    expect(bloco).toContain("jiló");
    // sem alerta clínico
    expect(bloco).not.toContain("revisão do nutricionista");
  });

  it("emite alerta de revisão e seções clínicas para paciente com comorbidade", () => {
    const bloco = montarBlocoFiltros(clinico);
    expect(bloco).toContain("revisão do nutricionista");
    expect(bloco).toContain("Alergias / intolerâncias");
    expect(bloco).toContain("Vetos clínicos");
    expect(bloco).toContain("Tetos clínicos");
    expect(bloco.toLowerCase()).toContain("lactose");
  });

  it("paciente sem nenhuma trava recebe bloco enxuto com nota de coerência", () => {
    const bloco = montarBlocoFiltros({ comportamento: {} });
    expect(bloco).toContain("Sem travas de segurança");
    expect(bloco).toContain("coerência de refeição");
  });
});
