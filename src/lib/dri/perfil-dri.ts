// Orquestração DRI ↔ pipeline de cálculo do NUTREAI.
//
// Política de energia (definida pelo nutricionista):
//  - Adulto (19-59): mantém o PADRÃO-OURO — GET Mifflin-St Jeor de calculos.ts.
//  - Idoso (>=60) e criança/adolescente (<19): usam a EER específica da DRI.
//  - Micronutrientes e fibra: sempre vindos da DRI (independe da idade).

import {
  calcularEER,
  calcularEerCrianca,
  getDRIs,
  selecionarEstagio,
  type Pal,
  type PacienteDri,
} from "./dri";
import { carregarDri, type SexoEntrada } from "./dri-data";

// Idade de corte para "idoso" (padrão clínico brasileiro: 60+).
const IDADE_IDOSO = 60;

export type FaixaClinica = "crianca_adolescente" | "adulto" | "idoso";

/** Faixa clínica que decide a fonte de energia. */
export function faixaClinica(idadeAnos: number): FaixaClinica {
  if (idadeAnos < 19) return "crianca_adolescente";
  if (idadeAnos >= IDADE_IDOSO) return "idoso";
  return "adulto";
}

// Mapa fator de atividade (Mifflin) -> PAL (DRI). A DRI tem 4 níveis; os
// fatores 1,725 e 1,9 caem ambos em very_active.
const FATOR_PARA_PAL: ReadonlyArray<readonly [number, Pal]> = [
  [1.2, "inactive"],
  [1.375, "low_active"],
  [1.55, "active"],
  [1.725, "very_active"],
  [1.9, "very_active"],
];

/** Converte o fator de atividade do sistema no PAL da DRI (o mais próximo). */
export function palDeFator(fatorAtividade: number): Pal {
  let melhor = FATOR_PARA_PAL[0];
  for (const par of FATOR_PARA_PAL) {
    if (Math.abs(par[0] - fatorAtividade) < Math.abs(melhor[0] - fatorAtividade)) {
      melhor = par;
    }
  }
  return melhor[1];
}

export interface DadosEnergia {
  sexo: SexoEntrada;
  idadeAnos: number;
  pesoKg: number;
  alturaCm: number;
  fatorAtividade: number;
}

export interface ResultadoEnergiaOrquestrada {
  faixa: FaixaClinica;
  metodo: "mifflin_get" | "eer_dri";
  eerKcal: number | null; // preenchido só quando metodo = eer_dri e aplicável
  aviso?: string;
}

/**
 * Decide a fonte de energia do paciente conforme a política:
 *  - adulto -> Mifflin GET (sinaliza metodo, sem valor: quem calcula é calculos.ts)
 *  - idoso -> EER adulto (DRI)
 *  - criança/adolescente -> EER infantil (DRI) + aviso de deposição
 *
 * Quando a EER não é aplicável (ex.: criança fora de 3-18), cai de volta no
 * Mifflin com o aviso preservado, para nunca ficar sem energia calculada.
 */
export function resolverEnergia(dados: DadosEnergia): ResultadoEnergiaOrquestrada {
  const faixa = faixaClinica(dados.idadeAnos);
  if (faixa === "adulto") {
    return { faixa, metodo: "mifflin_get", eerKcal: null };
  }

  const pal = palDeFator(dados.fatorAtividade);
  const r =
    faixa === "idoso"
      ? calcularEER(dados.sexo, dados.idadeAnos, dados.pesoKg, dados.alturaCm, pal)
      : calcularEerCrianca(
          dados.sexo,
          dados.idadeAnos,
          dados.pesoKg,
          dados.alturaCm,
          pal,
        );

  if (r.aplicavel && r.eerKcal != null) {
    return { faixa, metodo: "eer_dri", eerKcal: r.eerKcal, aviso: r.aviso };
  }
  // EER indisponível para o caso: mantém Mifflin, mas carrega o aviso adiante.
  return { faixa, metodo: "mifflin_get", eerKcal: null, aviso: r.aviso };
}

// Nutrientes que NÃO entram no bloco DRI porque já vêm do cálculo do sistema
// (energia/macros/água): proteína, carboidrato, gordura e água total.
const EXCLUIR_DO_BLOCO: ReadonlySet<string> = new Set([
  "protein",
  "carbohydrate",
  "fat",
  "total_water",
]);

/**
 * Monta um bloco markdown com as metas de micronutrientes e fibra (DRI) do
 * estágio de vida do paciente, para injetar no contexto de geração da dieta.
 * Energia e macros continuam vindo dos cálculos do sistema — este bloco é
 * qualitativo (atingir RDA/AI, não ultrapassar UL).
 */
export function montarBlocoDri(paciente: PacienteDri): string {
  const banco = carregarDri();
  const estagio = selecionarEstagio(
    paciente.sexo,
    paciente.idadeAnos,
    paciente.gestante ?? false,
    paciente.lactante ?? false,
  );
  const rotuloEstagio = banco.life_stage_groups[estagio]?.label ?? estagio;

  const refs = getDRIs(paciente).filter((r) => !EXCLUIR_DO_BLOCO.has(r.chave));

  const linhas = refs.map((r) => {
    const meta = r.rda_ai != null ? `${r.rda_ai} (${r.type})` : "—";
    const ul = r.ul != null ? `${r.ul}` : "—";
    return `| ${r.nome} | ${meta} | ${ul} |`;
  });

  return [
    "### Referências DRI — micronutrientes e fibra (metas do estágio de vida)",
    `Estágio: ${rotuloEstagio} (${estagio}). Fonte: NASEM/IOM.`,
    "Use como metas qualitativas ao montar as refeições: priorize atingir a meta (RDA/AI) e nunca ultrapassar o UL. Energia, proteína, carboidrato, gordura e água continuam vindo dos cálculos do sistema acima.",
    "",
    "| Nutriente | Meta (RDA/AI) | UL |",
    "|---|---|---|",
    ...linhas,
  ].join("\n");
}
