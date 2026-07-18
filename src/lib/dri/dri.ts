// Serviço de DRI do NUTREAI.
// A partir dos dados do paciente (sexo, idade, gestação/lactação), devolve as
// referências nutricionais aplicáveis: estágio de vida, DRIs por nutriente,
// avaliação de ingestão e necessidade energética estimada (EER).
//
// Funções puras: recebem dados e o banco (lido do JSON via carregarDri()) e
// retornam resultados. O modelo de IA NUNCA calcula — recebe isto pronto.

import {
  carregarDri,
  type BancoDri,
  type CoefEer,
  type SexoEntrada,
  type ValorNutriente,
} from "./dri-data";

// ---- Entradas ----

/** Dados mínimos do paciente para consultar as DRIs. */
export interface PacienteDri {
  sexo: SexoEntrada;
  idadeAnos: number;
  gestante?: boolean;
  lactante?: boolean;
}

/** Nível de atividade física (PAL) aceito na equação de EER. */
export type Pal = "inactive" | "low_active" | "active" | "very_active";

// ---- Saídas ----

/** Referência de um nutriente já resolvida para o estágio do paciente. */
export interface ReferenciaNutriente {
  chave: string; // chave do nutriente no banco (ex.: "iron")
  nome: string;
  unidade: string;
  ear: number | null;
  rda_ai: number | null;
  type: "RDA" | "AI";
  ul: number | null;
}

/** Classificação de uma ingestão frente às DRIs. */
export type ClassificacaoIngestao =
  | "abaixo_EAR" // risco de inadequação (ingestão < EAR)
  | "intermediario" // entre EAR e a meta (RDA/AI), ou abaixo de um AI sem EAR
  | "adequado" // >= RDA/AI
  | "atencao_UL"; // >= UL (risco por excesso)

export interface ResultadoIngestao {
  nutriente: string;
  classificacao: ClassificacaoIngestao;
  valorConsumido: number;
  ear: number | null;
  rda_ai: number | null;
  ul: number | null;
  unidade: string;
}

export interface ResultadoEer {
  aplicavel: boolean;
  eerKcal: number | null;
  aviso?: string;
}

// ---- Normalização de sexo ----

/** Converte qualquer forma aceita de sexo para "masculino" | "feminino". */
function normalizarSexo(sexo: SexoEntrada): "masculino" | "feminino" {
  const s = sexo.toLowerCase();
  if (s === "m" || s === "masculino") return "masculino";
  if (s === "f" || s === "feminino") return "feminino";
  throw new Error(`Sexo inválido: ${sexo}`);
}

// Faixas etárias de 9+ anos: [idade mínima, idade máxima, sufixo da chave].
const FAIXAS_ADULTO: ReadonlyArray<readonly [number, number, string]> = [
  [9, 13, "913"],
  [14, 18, "1418"],
  [19, 30, "1930"],
  [31, 50, "3150"],
  [51, 70, "5170"],
  [71, 120, "71"],
];

// Faixas válidas para gestação/lactação (só existem 14-50 no banco).
const FAIXAS_REPRODUTIVAS: ReadonlyArray<readonly [number, number, string]> = [
  [14, 18, "1418"],
  [19, 30, "1930"],
  [31, 50, "3150"],
];

/**
 * Seleciona a chave de life_stage_group correta para o paciente.
 *
 * Regras (ver README):
 *  - < 1 ano: "i06" (< 7 meses) ou "i712"
 *  - 1-3: "c13" | 4-8: "c48"
 *  - gestante/lactante (14-50): prefixo "p"/"l" + faixa (1418,1930,3150)
 *  - 9+: prefixo "m"/"f" por sexo + faixa (913,1418,1930,3150,5170,71)
 *
 * @throws se a chave calculada não existir no banco.
 */
export function selecionarEstagio(
  sexo: SexoEntrada,
  idadeAnos: number,
  gestante = false,
  lactante = false,
): string {
  if (!Number.isFinite(idadeAnos) || idadeAnos < 0) {
    throw new Error(`Idade inválida: ${idadeAnos}`);
  }

  const banco = carregarDri();
  let chave: string | undefined;

  if (idadeAnos < 1) {
    // < 7 meses vs 7-12 meses
    chave = idadeAnos * 12 < 7 ? "i06" : "i712";
  } else if (idadeAnos <= 3) {
    chave = "c13";
  } else if (idadeAnos <= 8) {
    chave = "c48";
  } else {
    // 9+ anos. Gestação/lactação têm precedência sobre o estágio adulto padrão,
    // mas só quando há uma faixa reprodutiva correspondente (14-50).
    if (gestante || lactante) {
      const prefixo = gestante ? "p" : "l";
      const faixa = FAIXAS_REPRODUTIVAS.find(
        ([lo, hi]) => idadeAnos >= lo && idadeAnos <= hi,
      );
      if (faixa) chave = prefixo + faixa[2];
    }

    // Fora da faixa reprodutiva (ou não gestante/lactante): estágio por sexo.
    if (chave === undefined) {
      const prefixo = normalizarSexo(sexo) === "masculino" ? "m" : "f";
      const faixa = FAIXAS_ADULTO.find(
        ([lo, hi]) => idadeAnos >= lo && idadeAnos <= hi,
      );
      if (faixa) chave = prefixo + faixa[2];
    }
  }

  if (chave === undefined || !(chave in banco.life_stage_groups)) {
    throw new Error(
      `Não foi possível mapear estágio de vida para sexo=${sexo}, idade=${idadeAnos}, gestante=${gestante}, lactante=${lactante} (chave=${chave})`,
    );
  }
  return chave;
}

/**
 * Retorna todas as referências nutricionais aplicáveis ao paciente, por
 * nutriente: nome, unidade, ear, rda_ai, type e ul.
 *
 * Só inclui nutrientes que têm valores para o estágio de vida do paciente.
 */
export function getDRIs(paciente: PacienteDri): ReferenciaNutriente[] {
  const banco = carregarDri();
  const estagio = selecionarEstagio(
    paciente.sexo,
    paciente.idadeAnos,
    paciente.gestante ?? false,
    paciente.lactante ?? false,
  );

  const referencias: ReferenciaNutriente[] = [];
  for (const [chave, nutriente] of Object.entries(banco.nutrients)) {
    const v = nutriente.values[estagio];
    if (!v) continue; // nutriente sem valor para este estágio
    referencias.push({
      chave,
      nome: nutriente.name,
      unidade: nutriente.unit,
      ear: v.ear ?? null,
      rda_ai: v.rda_ai ?? null,
      type: v.type,
      ul: v.ul ?? null,
    });
  }
  return referencias;
}

/**
 * Classifica uma ingestão de um nutriente para um estágio de vida.
 *
 * Ordem de avaliação (EAR e UL podem ser nulos):
 *  1. >= UL         -> "atencao_UL"  (risco por excesso)
 *  2. >= RDA/AI     -> "adequado"
 *  3. EAR e < EAR   -> "abaixo_EAR"  (risco de inadequação)
 *  4. demais casos  -> "intermediario" (entre EAR e a meta, ou abaixo de um AI)
 *
 * @throws se o nutriente ou o estágio não existirem no banco.
 */
export function avaliarIngestao(
  nutriente: string,
  valorConsumido: number,
  estagio: string,
): ResultadoIngestao {
  const banco = carregarDri();
  const nut = banco.nutrients[nutriente];
  if (!nut) throw new Error(`Nutriente desconhecido: ${nutriente}`);

  const v: ValorNutriente | undefined = nut.values[estagio];
  if (!v) {
    throw new Error(
      `Nutriente ${nutriente} não tem valores para o estágio ${estagio}`,
    );
  }

  const ear = v.ear ?? null;
  const meta = v.rda_ai ?? null;
  const ul = v.ul ?? null;

  let classificacao: ClassificacaoIngestao;
  if (ul !== null && valorConsumido >= ul) {
    classificacao = "atencao_UL";
  } else if (meta !== null && valorConsumido >= meta) {
    classificacao = "adequado";
  } else if (ear !== null && valorConsumido < ear) {
    classificacao = "abaixo_EAR";
  } else {
    // Entre EAR e a meta (RDA), ou abaixo de um AI (sem EAR, não dá para
    // estimar inadequação): não é risco alto, mas também não atinge a meta.
    classificacao = "intermediario";
  }

  return {
    nutriente,
    classificacao,
    valorConsumido,
    ear,
    rda_ai: meta,
    ul,
    unidade: nut.unit,
  };
}

const PALS_VALIDOS: ReadonlySet<Pal> = new Set<Pal>([
  "inactive",
  "low_active",
  "active",
  "very_active",
]);

/**
 * Calcula a EER (necessidade energética estimada, kcal/dia) de um adulto
 * usando energy_eer.adultos e a fórmula (2023):
 *
 *   EER = intercept + coef_idade*idade + coef_altura*altura_cm + coef_peso*peso_kg
 *
 * O coeficiente de idade já vem negativo no banco, então a soma direta aplica
 * o "- (coef_idade × idade)" do formato documentado.
 *
 * Para < 19 anos, gestação e lactação, a fórmula precisa do incremento de
 * deposição/produção de leite (ainda não incluído aqui): retorna um aviso e
 * eerKcal = null.
 *
 * @throws se o PAL for inválido.
 */
export function calcularEER(
  sexo: SexoEntrada,
  idadeAnos: number,
  pesoKg: number,
  alturaCm: number,
  pal: Pal,
  gestante = false,
  lactante = false,
): ResultadoEer {
  if (!PALS_VALIDOS.has(pal)) {
    throw new Error(
      `PAL inválido: ${pal}. Use inactive | low_active | active | very_active.`,
    );
  }

  if (idadeAnos < 19 || gestante || lactante) {
    const motivo =
      idadeAnos < 19
        ? "menores de 19 anos (crescimento)"
        : gestante
          ? "gestação"
          : "lactação";
    return {
      aplicavel: false,
      eerKcal: null,
      aviso: `EER para ${motivo} requer o incremento de deposição, ainda não incluído neste módulo (apenas adultos não gestantes/lactantes).`,
    };
  }

  const banco: BancoDri = carregarDri();
  const grupo =
    normalizarSexo(sexo) === "masculino"
      ? banco.energy_eer.adultos.homem_19_mais
      : banco.energy_eer.adultos.mulher_19_mais;

  const c = grupo[pal];
  if (!c) {
    throw new Error(`Coeficientes de EER ausentes para PAL ${pal}`);
  }

  const eer =
    c.intercept + c.age * idadeAnos + c.height * alturaCm + c.weight * pesoKg;

  return { aplicavel: true, eerKcal: Math.round(eer) };
}

/**
 * Calcula a EER de criança/adolescente (3-18 anos) usando
 * energy_eer.criancas_adolescentes (equações 2023 por sexo/PAL).
 *
 * ATENÇÃO CLÍNICA: o próprio banco sinaliza que a energia de DEPOSIÇÃO
 * (crescimento) é tratada à parte (Tabela S-2) e NÃO está embutida como número
 * usável no JSON. O valor retornado é a estimativa da equação e vem SEMPRE com
 * um aviso para o nutricionista confirmar/ajustar a deposição. Casos <18 já
 * entram como revisão obrigatória.
 *
 * Fora de 3-18 retorna aviso sem valor.
 *
 * @throws se o PAL for inválido.
 */
export function calcularEerCrianca(
  sexo: SexoEntrada,
  idadeAnos: number,
  pesoKg: number,
  alturaCm: number,
  pal: Pal,
): ResultadoEer {
  if (!PALS_VALIDOS.has(pal)) {
    throw new Error(
      `PAL inválido: ${pal}. Use inactive | low_active | active | very_active.`,
    );
  }

  if (idadeAnos < 3 || idadeAnos > 18) {
    return {
      aplicavel: false,
      eerKcal: null,
      aviso: `EER de criança/adolescente do banco cobre apenas 3-18 anos; idade ${idadeAnos} fora da faixa — defina a energia manualmente.`,
    };
  }

  const banco: BancoDri = carregarDri();
  const cria = banco.energy_eer.criancas_adolescentes as
    | Record<string, Record<string, CoefEer>>
    | undefined;
  const grupo =
    normalizarSexo(sexo) === "masculino" ? cria?.menino_3_18 : cria?.menina_3_18;
  const c = grupo?.[pal];
  if (!c) {
    throw new Error(`Coeficientes de EER infantil ausentes para PAL ${pal}`);
  }

  const eer =
    c.intercept + c.age * idadeAnos + c.height * alturaCm + c.weight * pesoKg;

  return {
    aplicavel: true,
    eerKcal: Math.round(eer),
    aviso:
      "EER infantil (3-18): confirme/adicione a energia de deposição de crescimento (Tabela S-2 do relatório 2023) — não incluída no cálculo.",
  };
}
