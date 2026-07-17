// Carregador do banco de DRI (Dietary Reference Intakes) do NUTREAI.
// Fonte: National Academies (NASEM/IOM) — ver README_DRI_NUTREAI.md.
//
// Regra: os valores NUNCA são hardcodados no código. Tudo é lido do
// dri_nutreai.json, carregado uma única vez e mantido em cache em memória.

import driJson from "./dri_nutreai.json";

// ---- Tipos que espelham o schema documentado no README ----

/** Sexo aceito na entrada; normalizado internamente para "masculino"/"feminino". */
export type SexoEntrada = "masculino" | "feminino" | "M" | "F" | "m" | "f";

/** Um grupo de estágio de vida (ex.: "f3150" = Mulher 31-50 anos). */
export interface GrupoEstagio {
  label: string;
  sex: string;
  stage: string;
  age_min_y: number;
  age_max_y: number;
}

/** Valores de referência de um nutriente para um estágio de vida. */
export interface ValorNutriente {
  ear?: number | null; // atende 50% do grupo; pode ser nulo (nutriente do tipo AI)
  rda_ai: number | null; // meta de ingestão (RDA ou AI, conforme "type")
  type: "RDA" | "AI";
  ul?: number | null; // limite superior tolerável; pode ser nulo
}

/** Um nutriente completo com seus valores por estágio de vida. */
export interface Nutriente {
  name: string;
  category?: string;
  unit: string;
  values: Record<string, ValorNutriente>;
  ul_unit?: string;
}

/** Coeficientes da equação de EER de um sexo/PAL (adultos, 2023). */
export interface CoefEer {
  intercept: number;
  age: number; // já vem com o sinal correto (negativo)
  height: number;
  weight: number;
}

/** Estrutura completa do banco (apenas os campos que o serviço consome). */
export interface BancoDri {
  meta: Record<string, unknown>;
  life_stage_groups: Record<string, GrupoEstagio>;
  life_stage_order: string[];
  nutrients: Record<string, Nutriente>;
  energy_eer: {
    unidade: string;
    formato: string;
    pal_categorias: string[];
    adultos: {
      homem_19_mais: Record<string, CoefEer>;
      mulher_19_mais: Record<string, CoefEer>;
    };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

// ---- Cache em memória (carrega uma vez) ----

let cache: BancoDri | null = null;

/**
 * Retorna o banco de DRI. O JSON é importado uma única vez (o import é
 * resolvido pelo bundler) e a referência fica em cache — chamadas seguintes
 * não reprocessam nada.
 */
export function carregarDri(): BancoDri {
  if (cache === null) {
    cache = driJson as unknown as BancoDri;
  }
  return cache;
}
