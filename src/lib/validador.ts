// Validador de saída — roda em código antes de salvar/exibir qualquer dieta.
// Qualquer falha bloqueia o fluxo (regenerar ou revisão manual).

import { somaKcalMacros, type Macros } from "./calculos";

export const TERMOS_PROIBIDOS = [
  "detox",
  "secar",
  "queimar gordura",
  "acelerar metabolismo",
  "desinchar",
  "turbinar",
];

export interface EntradaValidacao {
  tmb: number;
  metaCalorica: number;
  macros: Macros;
  textoDieta: string;
  sexo: "masculino" | "feminino";
}

export interface ResultadoValidacao {
  ok: boolean;
  erros: string[];
  avisos: string[]; // não bloqueiam, mas aparecem no painel
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function encontrarTermosProibidos(texto: string): string[] {
  const norm = normalizar(texto);
  return TERMOS_PROIBIDOS.filter((termo) => {
    const t = normalizar(termo).replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${t}`, "i").test(norm);
  });
}

// extrai "Meta Calórica: 2006 kcal" do texto do plano
export function extrairMetaDoTexto(texto: string): number | null {
  const m = texto.match(/meta\s+cal[oó]rica:?\s*\*?\s*([\d][\d.,]*)\s*kcal/i);
  if (!m) return null;
  const bruto = m[1].replace(/\./g, "").replace(",", ".");
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

export function validarDieta(entrada: EntradaValidacao): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];
  const { tmb, metaCalorica, macros, textoDieta, sexo } = entrada;

  // 1. Meta calórica >= TMB
  if (metaCalorica < tmb) {
    erros.push(
      `Meta calórica (${Math.round(metaCalorica)} kcal) abaixo da TMB (${Math.round(tmb)} kcal).`
    );
  }

  // 2. Soma dos macros = meta ±2%
  const soma = somaKcalMacros(macros);
  const desvio = Math.abs(soma - metaCalorica) / metaCalorica;
  if (desvio > 0.02) {
    erros.push(
      `Soma dos macros (${soma} kcal) fora da tolerância de ±2% da meta (${Math.round(metaCalorica)} kcal).`
    );
  }

  // 3. Termos proibidos no texto
  const termos = encontrarTermosProibidos(textoDieta);
  if (termos.length > 0) {
    erros.push(`Termos proibidos no texto: ${termos.join(", ")}.`);
  }

  // 4. Meta declarada no texto bate com a calculada (±2%)
  const metaTexto = extrairMetaDoTexto(textoDieta);
  if (metaTexto === null) {
    erros.push("Não foi possível localizar a Meta Calórica declarada no texto do plano.");
  } else if (Math.abs(metaTexto - metaCalorica) / metaCalorica > 0.02) {
    erros.push(
      `Meta declarada no plano (${metaTexto} kcal) difere da calculada (${Math.round(metaCalorica)} kcal).`
    );
  }

  // 5. Piso calórico — exige revisão explícita (não bloqueia sozinho; destaca)
  const piso = sexo === "feminino" ? 1200 : 1500;
  if (metaCalorica < piso) {
    avisos.push(
      `Meta calórica (${Math.round(metaCalorica)} kcal) abaixo do piso de ${piso} kcal para ${sexo === "feminino" ? "mulheres" : "homens"} — exige revisão explícita do nutricionista.`
    );
  }

  return { ok: erros.length === 0, erros, avisos };
}
