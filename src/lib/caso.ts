import type { Macros, PerfilMetabolico } from "./calculos";

// Estrutura da memória do caso (coluna JSON em Caso.memoria)
export interface MemoriaCaso {
  anamnese?: Record<string, unknown>; // payload completo do evento anamnese_completa
  medidasBaseline?: Record<string, number>;
  pesoBaselineKg?: number;
  flags?: string[];
  perfilMetabolico?: PerfilMetabolico;
  metaCalorica?: number;
  macros?: Macros;
  indiceProgressao?: number;
  historicoIndice?: { data: string; indice: number }[];
  pedidosDeMudanca?: string[];
  ultimoPesoKg?: number;
  ultimasMedidas?: Record<string, number>;
  ultimoRegistroEm?: string; // ISO
  alertasSubstituicao?: AlertaSubstituicao[]; // trocas provisionadas que pedem ciência do nutricionista
}

// Alerta emitido pela IA quando provisiona uma substituição sem plena certeza.
export interface AlertaSubstituicao {
  refeicao: string;
  alimentoOriginal: string;
  sugerido: string;
  motivo: string;
  nivel: string; // A | B | C
  confianca: string; // alta | media | baixa
  em: string; // ISO
  resolvido: boolean;
}

export function lerMemoria(memoriaJson: string): MemoriaCaso {
  try {
    return JSON.parse(memoriaJson) as MemoriaCaso;
  } catch {
    return {};
  }
}

export const DIAS_CICLO = 26; // ciclo mensal "fecha" a partir daqui

export function diasDesde(data: Date | null | undefined): number | null {
  if (!data) return null;
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24));
}

// Flags determinísticas re-checadas em código (defesa além do modelo)
export function flagsDeterministicas(anamnese: Record<string, unknown>): string[] {
  const flags: string[] = [];
  const idade = Number(anamnese.idade);
  const pesoKg = Number(anamnese.pesoKg);
  const alturaCm = Number(anamnese.alturaCm);
  if (Number.isFinite(idade) && idade < 18) flags.push("menor de 18 anos");
  if (Number.isFinite(pesoKg) && Number.isFinite(alturaCm) && alturaCm > 0) {
    const imc = pesoKg / Math.pow(alturaCm / 100, 2);
    if (imc < 17) flags.push("IMC < 17");
    const saude = (anamnese.saude ?? {}) as Record<string, unknown>;
    const diagnosticos = Array.isArray(saude.diagnosticos) ? saude.diagnosticos : [];
    if (imc > 40 && diagnosticos.length >= 2) flags.push("IMC > 40 com comorbidades múltiplas");
  }
  const ctx = anamnese.contextoFeminino as Record<string, unknown> | null | undefined;
  if (ctx) {
    if (ctx.gestante === true) flags.push("gestação");
    if (ctx.amamentando === true) flags.push("amamentação");
  }
  const mp = anamnese.melhoradoresPerformance as Record<string, unknown> | null | undefined;
  if (mp && mp.usa === true) flags.push("uso de melhoradores de performance");
  return flags;
}

export function unirFlags(doModelo: unknown, deterministicas: string[]): string[] {
  const modelo = Array.isArray(doModelo) ? doModelo.map(String) : [];
  const todas = [...modelo];
  for (const f of deterministicas) {
    const jaTem = todas.some((m) => m.toLowerCase().includes(f.split(" ")[0].toLowerCase()));
    if (!jaTem) todas.push(f);
  }
  return todas;
}
