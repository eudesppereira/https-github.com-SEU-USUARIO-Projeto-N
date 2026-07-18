// Cálculos metabólicos do Nutre.AI — Etapa 10 do prompt v2.
// Funções puras; o modelo NUNCA calcula: recebe estes resultados prontos no contexto.

export type Sexo = "masculino" | "feminino";

export type Objetivo =
  | "emagrecimento"
  | "ganho"
  | "manutencao"
  | "performance";

export interface PerfilCalculo {
  sexo: Sexo;
  idade: number;
  pesoKg: number;
  alturaCm: number;
  fatorAtividade: number; // 1.2 | 1.375 | 1.55 | 1.725 | 1.9
  objetivo: Objetivo;
}

export interface Macros {
  proteinaG: number;
  carboidratoG: number;
  gorduraG: number;
}

export interface PerfilMetabolico {
  imc: number;
  classificacaoImc: string;
  tmb: number;
  get: number;
  metaCalorica: number;
  macros: Macros;
  aguaLitros: number;
  mmeKg: number | null; // massa magra estimada, apenas quando IMC >= 30
  percentualGorduraEstimado: number | null;
  proteinaGPorKgBase: number; // g/kg usado (peso atual ou MME)
  abaixoDoPisoCalorico: boolean; // <1200 kcal mulheres / <1500 homens — exige revisão explícita
  metodoEnergia: "mifflin_get" | "eer_dri"; // como o gasto energético base foi obtido
  eerKcal: number | null; // EER (DRI) quando usado no lugar do GET (idoso/criança)
  avisoEnergia?: string; // ressalva do método de energia (ex.: deposição de crescimento)
}

// Ajuste opcional da fonte de energia. Sem opções, mantém o padrão-ouro
// (GET = TMB × fator de atividade, Mifflin-St Jeor). Idoso/criança usam a EER
// (DRI) — a orquestração passa getOverride com o valor da EER.
export interface OpcoesEnergia {
  getOverride?: number; // substitui o GET (kcal/dia)
  metodoEnergia?: "mifflin_get" | "eer_dri";
  avisoEnergia?: string;
}

// IMC = peso / (altura em m)^2
export function calcularImc(pesoKg: number, alturaCm: number): number {
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

export function classificarImc(imc: number): string {
  if (imc < 18.5) return "baixo peso";
  if (imc < 25) return "eutrofia";
  if (imc < 30) return "sobrepeso";
  if (imc < 35) return "obesidade grau I";
  if (imc < 40) return "obesidade grau II";
  return "obesidade grau III";
}

// TMB — Mifflin-St Jeor
export function calcularTmb(
  sexo: Sexo,
  pesoKg: number,
  alturaCm: number,
  idade: number
): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return sexo === "masculino" ? base + 5 : base - 161;
}

export function calcularGet(tmb: number, fatorAtividade: number): number {
  return tmb * fatorAtividade;
}

// Meta calórica por objetivo. Emagrecimento: déficit padrão 20% (15–25%), nunca abaixo da TMB.
export function calcularMetaCalorica(
  objetivo: Objetivo,
  get: number,
  tmb: number,
  opcoes?: { deficit?: number; superavitGanho?: number; ajustePerformance?: number }
): number {
  switch (objetivo) {
    case "emagrecimento": {
      const deficit = opcoes?.deficit ?? 0.2;
      return Math.max(get * (1 - deficit), tmb);
    }
    case "ganho":
      return get + (opcoes?.superavitGanho ?? 400); // 300–500, padrão 400
    case "performance":
      return get + (opcoes?.ajustePerformance ?? 300);
    case "manutencao":
      return get;
  }
}

// %G estimado para IMC >= 30 (a favor do paciente: faixa mais baixa)
export function estimarPercentualGordura(imc: number, sexo: Sexo): number | null {
  if (imc < 30) return null;
  if (imc < 35) return sexo === "masculino" ? 0.28 : 0.38;
  if (imc < 40) return sexo === "masculino" ? 0.33 : 0.43;
  return sexo === "masculino" ? 0.38 : 0.48;
}

// MME = peso atual × (1 − %G estimado)
export function calcularMme(pesoKg: number, percentualGordura: number): number {
  return pesoKg * (1 - percentualGordura);
}

// Proteína: IMC < 30 → 1,6–2,2 g/kg peso atual (padrão 1,8);
// IMC >= 30 → 2,0–2,2 g/kg de MME (padrão 2,0)
export function calcularProteinaG(
  pesoKg: number,
  imc: number,
  sexo: Sexo
): { proteinaG: number; gPorKg: number; mmeKg: number | null; percentualG: number | null } {
  const percentualG = estimarPercentualGordura(imc, sexo);
  if (percentualG === null) {
    const gPorKg = 1.8;
    return { proteinaG: Math.round(pesoKg * gPorKg), gPorKg, mmeKg: null, percentualG: null };
  }
  const mme = calcularMme(pesoKg, percentualG);
  const gPorKg = 2.0;
  return { proteinaG: Math.round(mme * gPorKg), gPorKg, mmeKg: mme, percentualG };
}

// Macros por objetivo. Carboidrato fecha a conta para a soma bater com a meta (±2%).
export function calcularMacros(
  objetivo: Objetivo,
  metaCalorica: number,
  pesoKg: number,
  imc: number,
  sexo: Sexo
): { macros: Macros; proteinaInfo: ReturnType<typeof calcularProteinaG> } {
  const proteinaInfo = calcularProteinaG(pesoKg, imc, sexo);
  let proteinaG: number;
  let gorduraG: number;

  switch (objetivo) {
    case "emagrecimento": {
      proteinaG = proteinaInfo.proteinaG;
      gorduraG = Math.round((metaCalorica * 0.25) / 9); // 20–30%, padrão 25%
      break;
    }
    case "ganho": {
      proteinaG = proteinaInfo.proteinaG;
      // carbo 4–7 g/kg (padrão 5); gordura = restante, mínimo 20%
      let carboG = Math.round(pesoKg * 5);
      let gorduraKcal = metaCalorica - proteinaG * 4 - carboG * 4;
      const gorduraMinKcal = metaCalorica * 0.2;
      if (gorduraKcal < gorduraMinKcal) {
        gorduraKcal = gorduraMinKcal;
        carboG = Math.round((metaCalorica - proteinaG * 4 - gorduraKcal) / 4);
      }
      gorduraG = Math.round(gorduraKcal / 9);
      const macros = ajustarCarboParaFechar(metaCalorica, proteinaG, gorduraG, carboG);
      return { macros, proteinaInfo };
    }
    case "manutencao": {
      // proteína 0,8–1,6 g/kg (padrão 1,2); gordura 20–35% (padrão 30%); carbo = restante (45–65%)
      proteinaG = Math.round(pesoKg * 1.2);
      gorduraG = Math.round((metaCalorica * 0.3) / 9);
      break;
    }
    case "performance": {
      proteinaG = proteinaInfo.proteinaG;
      gorduraG = Math.round((metaCalorica * 0.25) / 9);
      break;
    }
  }

  const carboG = Math.round((metaCalorica - proteinaG * 4 - gorduraG * 9) / 4);
  const macros = ajustarCarboParaFechar(metaCalorica, proteinaG, gorduraG, carboG);
  return { macros, proteinaInfo };
}

function ajustarCarboParaFechar(
  metaCalorica: number,
  proteinaG: number,
  gorduraG: number,
  carboG: number
): Macros {
  // recalcula carbo para a soma cair dentro de ±2% da meta
  const carboFinal = Math.max(
    0,
    Math.round((metaCalorica - proteinaG * 4 - gorduraG * 9) / 4)
  );
  void carboG;
  return { proteinaG, carboidratoG: carboFinal, gorduraG };
}

export function somaKcalMacros(macros: Macros): number {
  return macros.proteinaG * 4 + macros.carboidratoG * 4 + macros.gorduraG * 9;
}

// Hidratação: 35 ml/kg/dia, teto prático de 4 L, + 500 ml por hora de treino intenso
export function calcularAguaLitros(pesoKg: number, horasTreinoIntenso = 0): number {
  const base = Math.min((pesoKg * 35) / 1000, 4);
  const total = base + 0.5 * horasTreinoIntenso;
  return Math.round(total * 10) / 10;
}

export function calcularPerfilMetabolico(
  perfil: PerfilCalculo,
  opcoes?: OpcoesEnergia
): PerfilMetabolico {
  const imc = calcularImc(perfil.pesoKg, perfil.alturaCm);
  const tmb = calcularTmb(perfil.sexo, perfil.pesoKg, perfil.alturaCm, perfil.idade);
  // GET padrão (Mifflin) — substituído pela EER (DRI) quando a orquestração
  // passa getOverride (idoso/criança). A TMB continua sendo o piso da meta.
  const get = opcoes?.getOverride ?? calcularGet(tmb, perfil.fatorAtividade);
  const metaCalorica = calcularMetaCalorica(perfil.objetivo, get, tmb);
  const { macros, proteinaInfo } = calcularMacros(
    perfil.objetivo,
    metaCalorica,
    perfil.pesoKg,
    imc,
    perfil.sexo
  );
  const piso = perfil.sexo === "feminino" ? 1200 : 1500;
  return {
    imc: Math.round(imc * 10) / 10,
    classificacaoImc: classificarImc(imc),
    tmb: Math.round(tmb),
    get: Math.round(get),
    metaCalorica: Math.round(metaCalorica),
    macros,
    aguaLitros: calcularAguaLitros(perfil.pesoKg),
    mmeKg: proteinaInfo.mmeKg !== null ? Math.round(proteinaInfo.mmeKg * 10) / 10 : null,
    percentualGorduraEstimado: proteinaInfo.percentualG,
    proteinaGPorKgBase: proteinaInfo.gPorKg,
    abaixoDoPisoCalorico: metaCalorica < piso,
    metodoEnergia: opcoes?.metodoEnergia ?? "mifflin_get",
    eerKcal: opcoes?.getOverride != null ? Math.round(opcoes.getOverride) : null,
    avisoEnergia: opcoes?.avisoEnergia,
  };
}

// Índice de progressão (0–10): adesão 40% + evolução física 40% + consistência 20%.
// Interno — nunca expor a nota fria ao paciente.
export function calcularIndiceProgressao(
  adesao0a10: number,
  evolucaoFisica0a10: number,
  checkinsRespondidos: number,
  checkinsEsperados: number
): number {
  const consistencia =
    checkinsEsperados > 0
      ? Math.min(checkinsRespondidos / checkinsEsperados, 1) * 10
      : 0;
  const indice = 0.4 * adesao0a10 + 0.4 * evolucaoFisica0a10 + 0.2 * consistencia;
  return Math.round(indice * 10) / 10;
}

// Evolução física vs. esperado para o objetivo (heurística p/ índice):
// emagrecimento espera 0,5–1% do peso/semana; ganho 0,25–0,5 kg/mês.
export function avaliarEvolucaoFisica(
  objetivo: Objetivo,
  pesoInicialKg: number,
  pesoAnteriorKg: number,
  pesoAtualKg: number,
  semanasDesdeAnterior: number
): number {
  if (semanasDesdeAnterior <= 0) return 5;
  const deltaSemanal = (pesoAnteriorKg - pesoAtualKg) / semanasDesdeAnterior;
  if (objetivo === "emagrecimento") {
    const esperadoMin = pesoInicialKg * 0.005;
    const esperadoMax = pesoInicialKg * 0.01;
    if (deltaSemanal >= esperadoMin && deltaSemanal <= esperadoMax) return 10;
    if (deltaSemanal > esperadoMax) return 6; // perda rápida demais → atenção
    if (deltaSemanal > 0) return 7;
    return 3;
  }
  if (objetivo === "ganho") {
    const ganhoSemanal = -deltaSemanal;
    const esperadoMin = 0.25 / 4;
    const esperadoMax = 0.5 / 4;
    if (ganhoSemanal >= esperadoMin && ganhoSemanal <= esperadoMax) return 10;
    if (ganhoSemanal > esperadoMax) return 6;
    if (ganhoSemanal > 0) return 7;
    return 3;
  }
  // manutenção/performance: estável = bom
  const variacaoPercent = Math.abs(pesoAtualKg - pesoAnteriorKg) / pesoAnteriorKg;
  return variacaoPercent < 0.02 ? 10 : 6;
}
