// Motor de conduta clínica: casa as condições/medicações/objetivo do paciente
// com a base `nutre-ai-base-conduta.json` (50 doenças + interações fármaco-
// nutriente + motor de conflito em 4 camadas) e monta um bloco de contexto para
// injetar no prompt de geração da dieta. Só emite conteúdo quando há condição
// clínica relevante — paciente saudável não é afetado.

import fs from "fs";
import path from "path";

interface HardConstraint {
  nutriente?: string;
  interacao?: string;
  min?: number;
  max?: number;
  valor?: string;
  condicional?: string;
  motivo: string;
}

interface Doenca {
  id: string;
  nome: string;
  categoria: string;
  severidade: number;
  objetivo: string;
  metas: Record<string, unknown>;
  condutas: string[];
  priorizar: string[];
  evitar: string[];
  hard_constraints: HardConstraint[];
  red_flags: string[];
  exames: string[];
  referencia: string;
  observacao_conflito?: string;
}

interface Interacao {
  id: string;
  medicamento: string;
  nutriente: string;
  trava: string;
  regra: string;
  risco: string;
  severidade: number;
}

interface BaseConduta {
  doencas: Doenca[];
  drug_nutrient_interactions: Interacao[];
  motor_de_conflito: Record<string, unknown>;
  escala_severidade: Record<string, unknown>;
}

let baseCache: BaseConduta | null = null;

export function carregarBaseConduta(): BaseConduta {
  if (!baseCache) {
    const bruto = fs.readFileSync(
      path.join(process.cwd(), "prompts", "nutre-ai-base-conduta.json"),
      "utf8"
    );
    baseCache = JSON.parse(bruto) as BaseConduta;
  }
  return baseCache;
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Sinônimos por id de doença — termos que aparecem no relato do paciente mas
// não batem por substring direta com o `nome` oficial. Só o necessário para as
// condições de linguagem cotidiana variável.
const SINONIMOS: Record<string, string[]> = {
  D01: ["diabetes tipo 2", "diabetes 2", "dm2", "dm 2", "diabetico tipo 2", "diabetes"],
  D02: ["diabetes tipo 1", "diabetes 1", "dm1", "dm 1"],
  D03: ["pre diabetes", "pre-diabetes", "resistencia insulinica", "resistencia a insulina", "homa alto"],
  D04: ["hipertensao", "pressao alta", "has", "hipertenso", "pressao"],
  D05: ["dislipidemia", "colesterol alto", "triglicerides alto", "triglicerideos", "ldl alto"],
  D06: ["obesidade", "obeso", "imc alto"],
  D07: ["sindrome metabolica"],
  D08: ["drc", "doenca renal cronica", "insuficiencia renal", "renal cronica", "rim", "renal estagio", "tfg baixa"],
  D09: ["dialise", "hemodialise", "dialitico"],
  D10: ["dhgna", "esteatose", "gordura no figado", "figado gorduroso", "masld"],
  D11: ["cirrose", "cirrotico"],
  D12: ["celiaca", "celiaco", "doenca celiaca", "gluten"],
  D13: ["crohn", "doenca de crohn"],
  D14: ["retocolite", "colite ulcerativa", "rcu"],
  D15: ["sii", "intestino irritavel", "colon irritavel"],
  D16: ["drge", "refluxo", "refluxo gastroesofagico"],
  D17: ["gastrite", "ulcera", "ulcera peptica"],
  D18: ["constipacao", "prisao de ventre", "intestino preso"],
  D19: ["diverticular", "diverticulite", "diverticulose"],
  D20: ["hipotireoidismo", "hipotireoide", "tireoide baixa"],
  D21: ["hipertireoidismo", "hipertireoide"],
  D22: ["sop", "ovario policistico", "ovarios policisticos"],
  D23: ["gota", "hiperuricemia", "acido urico alto"],
  D24: ["anemia", "anemia ferropriva", "ferro baixo", "ferritina baixa"],
  D25: ["osteoporose", "osteopenia"],
  D26: ["intolerancia a lactose", "intolerancia lactose", "intolerante a lactose", "lactose"],
  D27: ["gestante", "gestacao", "gravida", "gravidez"],
  D28: ["lactacao", "amamentando", "amamentacao", "lactante"],
  D29: ["menopausa", "climaterio", "perimenopausa"],
  D30: ["sarcopenia", "idoso", "perda de massa muscular"],
  D31: ["insuficiencia cardiaca", "ic", "coracao fraco"],
  D47: ["desnutricao", "desnutrido", "baixo peso severo"],
  D48: ["transtorno alimentar", "compulsao alimentar", "anorexia", "bulimia", "compulsao"],
  D49: ["dpoc", "enfisema", "bronquite cronica"],
  D50: ["fibromialgia"],
};

// Nome de medicamento (princípio ativo/marca) → id da interação. As interações
// da base usam nomes de CLASSE (ex.: "IECA/BRA"); este mapa liga os nomes reais
// que o paciente relata.
const MED_PARA_INTERACAO: Record<string, string[]> = {
  DNI01: ["varfarina", "marevan", "warfarin"],
  DNI02: ["tranilcipromina", "fenelzina", "imao"],
  DNI03: ["levotiroxina", "puran", "synthroid", "euthyrox"],
  DNI04: ["metformina", "glifage"],
  DNI05: ["losartana", "valsartana", "enalapril", "captopril", "ramipril", "espironolactona", "olmesartana", "ieca", "bra"],
  DNI06: ["furosemida", "lasix", "hidroclorotiazida", "clortalidona", "indapamida"],
  DNI07: ["prednisona", "prednisolona", "corticoide", "dexametasona"],
  DNI08: ["sinvastatina", "atorvastatina", "rosuvastatina", "estatina"],
  DNI09: ["alendronato", "risedronato", "bisfosfonato"],
  DNI10: ["tetraciclina", "ciprofloxacino", "levofloxacino", "doxiciclina"],
  DNI11: ["digoxina"],
  DNI12: ["fenitoina", "carbamazepina", "fenobarbital"],
};

// Objetivo da anamnese → id da doença-objetivo (severidade 1) que entra como
// "condição em disputa" no motor de conflito.
const OBJETIVO_PARA_ID: Record<string, string> = {
  ganho: "D45", // hipertrofia
  hipertrofia: "D45",
  emagrecimento: "D46",
  performance: "D45",
};

function termosDaDoenca(d: Doenca): string[] {
  const base = normalizar(d.nome.split("(")[0]);
  return [base, ...(SINONIMOS[d.id] ?? [])];
}

function coletarTextos(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.flatMap(coletarTextos);
  if (typeof valor === "object") return Object.values(valor as Record<string, unknown>).flatMap(coletarTextos);
  return [String(valor)];
}

export interface CondicoesDetectadas {
  doencas: Doenca[];
  interacoes: Interacao[];
  temContextoClinico: boolean;
}

// Casa a anamnese com a base. `diagnosticos` e `medicacoes` são listas de texto
// livre; objetivo/gestante/amamentando entram por campos estruturados.
export function detectarCondicoes(anamnese: Record<string, unknown>): CondicoesDetectadas {
  const base = carregarBaseConduta();
  const saude = (anamnese.saude ?? {}) as Record<string, unknown>;
  const contextoFem = (anamnese.contextoFeminino ?? {}) as Record<string, unknown>;

  const textoDiagnosticos = coletarTextos(saude.diagnosticos).concat(coletarTextos(saude.cirurgias)).map(normalizar);
  const textoMedicacoes = coletarTextos(saude.medicacoes).concat(coletarTextos(saude.suplementos)).map(normalizar);

  const idsDetectados = new Set<string>();

  // 1) doenças por diagnóstico
  for (const d of base.doencas) {
    const termos = termosDaDoenca(d);
    const bateu = textoDiagnosticos.some((diag) => termos.some((t) => t.length >= 3 && diag.includes(t)));
    if (bateu) idsDetectados.add(d.id);
  }

  // 2) contexto feminino estruturado (gestação/lactação)
  if (contextoFem.gestante === true || contextoFem.gestacao === true) idsDetectados.add("D27");
  if (contextoFem.amamentando === true || contextoFem.lactante === true) idsDetectados.add("D28");
  if (contextoFem.menopausa === true) idsDetectados.add("D29");

  const temClinico = idsDetectados.size > 0;

  // 3) objetivo (severidade 1) — só entra se já há condição clínica para pesar contra
  const objetivo = normalizar(String(anamnese.objetivo ?? ""));
  const idObjetivo = OBJETIVO_PARA_ID[objetivo];
  if (temClinico && idObjetivo) idsDetectados.add(idObjetivo);

  const doencas = base.doencas
    .filter((d) => idsDetectados.has(d.id))
    .sort((a, b) => b.severidade - a.severidade);

  // 4) interações fármaco-nutriente por medicação (nome real → id via mapa, com
  // fallback pelo nome de classe da própria interação)
  const interacoes = base.drug_nutrient_interactions.filter((it) => {
    const nomesReais = MED_PARA_INTERACAO[it.id] ?? [];
    if (textoMedicacoes.some((med) => nomesReais.some((n) => n.length >= 3 && med.includes(n)))) return true;
    const nomeMed = normalizar(it.medicamento.split("(")[0]).split("/")[0].trim();
    const primeiroTermo = nomeMed.split(" ")[0];
    return textoMedicacoes.some(
      (med) => (primeiroTermo.length >= 5 && med.includes(primeiroTermo)) || med.includes(nomeMed)
    );
  });

  return { doencas, interacoes, temContextoClinico: temClinico || interacoes.length > 0 };
}

function fmtMetas(metas: Record<string, unknown>): string {
  return JSON.stringify(metas);
}

// Monta o bloco de contexto clínico para o prompt de geração. Retorna "" quando
// não há condição clínica relevante (paciente saudável segue o fluxo normal).
export function montarBlocoConduta(anamnese: Record<string, unknown>): string {
  const { doencas, interacoes, temContextoClinico } = detectarCondicoes(anamnese);
  if (!temContextoClinico) return "";

  const linhas: string[] = [];
  linhas.push("## MOTOR DE CONDUTA CLÍNICA (OBRIGATÓRIO quando há condição clínica)");
  linhas.push(
    "O paciente tem condição(ões) clínica(s) e/ou medicação com interação nutricional. Use as condutas abaixo (extraídas da base de conduta do consultório) e RESOLVA os conflitos pelo motor de 4 camadas ANTES de montar o cardápio. As metas numéricas são ponto de partida — respeite as travas."
  );
  linhas.push("");
  linhas.push("### Condições ativas detectadas (ordenadas por severidade)");
  for (const d of doencas) {
    linhas.push(
      [
        `- **${d.nome}** (id ${d.id} · severidade ${d.severidade}/5 · ${d.categoria})`,
        `  - Objetivo terapêutico: ${d.objetivo}`,
        `  - Metas: ${fmtMetas(d.metas)}`,
        d.hard_constraints.length
          ? `  - ⛔ HARD CONSTRAINTS (invioláveis): ${d.hard_constraints
              .map((h) => `${h.nutriente ?? h.interacao ?? "?"}${h.max != null ? ` ≤${h.max}` : ""}${h.min != null ? ` ≥${h.min}` : ""}${h.valor ? `=${h.valor}` : ""}${h.condicional ? ` (${h.condicional})` : ""} — ${h.motivo}`)
              .join("; ")}`
          : "  - Hard constraints: nenhum",
        `  - Priorizar: ${d.priorizar.join(", ")}`,
        `  - Evitar: ${d.evitar.join(", ")}`,
        d.red_flags.length ? `  - Red flags: ${d.red_flags.join(", ")}` : "",
        d.observacao_conflito ? `  - ⚠ Conflito: ${d.observacao_conflito}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (interacoes.length) {
    linhas.push("");
    linhas.push("### Interações fármaco-nutriente (Camada 0 — travas invioláveis)");
    for (const it of interacoes) {
      linhas.push(`- **${it.medicamento}** × ${it.nutriente} [${it.trava}] — ${it.regra} (risco: ${it.risco})`);
    }
  }

  linhas.push("");
  linhas.push("### Motor de conflito — aplique NESTA ORDEM (nenhuma camada viola a anterior)");
  linhas.push(
    "- **Camada 0 (trava de segurança):** hard_constraints e interações de fármaco são limites invioláveis. Nenhum objetivo ultrapassa. Nunca."
  );
  linhas.push(
    "- **Camada 1 (hierarquia por risco):** em conflito entre condutas não-trava, vence a de maior severidade. Empate → vence a de menor reversibilidade (dano permanente > reversível), depois a mais aguda."
  );
  linhas.push(
    "- **Camada 2 (otimização na janela segura):** por nutriente, use a interseção das faixas [min,max]. Se existe interseção, escolha o ponto que favorece a maior severidade sem prejudicar as demais."
  );
  linhas.push(
    "- **Camada 3 (escalonamento — só quando as faixas NÃO se cruzam):** TRAVAR + FLAG. Fixe o limite seguro (da maior severidade/trava) E gere um alerta estruturado. NUNCA faça média entre faixas que não se cruzam. NUNCA deixe o paciente sem conduta."
  );
  linhas.push(
    "- **Trava anti-restrição (transtorno alimentar, severidade 5):** se detectado, NÃO gere plano restritivo/contagem — BLOQUEIE e escalone para o nutricionista."
  );
  linhas.push("");
  linhas.push("### Saída obrigatória com condição clínica");
  linhas.push(
    "1. No CARDÁPIO, aplique os valores finais pós-motor (hard_constraints respeitados sempre)."
  );
  linhas.push(
    "2. No RESUMO TÉCNICO, inclua uma seção **RELATÓRIO DE CONFLITOS** com uma linha por conflito, no formato:"
  );
  linhas.push(
    "   `[CONFLITO] Nutriente: <x> | Venceu: <condição> | Ajustada: <condição> | Valor aplicado: <v> | Valor desejado: <v> | Justificativa: <por quê> | Ação sugerida: <o que revisar>`"
  );
  linhas.push(
    "   Use `[BLOQUEIO]` quando algo foi bloqueado por segurança. Se não houve conflito, escreva \"Sem conflitos — condutas compatíveis\"."
  );
  linhas.push(
    "3. Feche o RESUMO TÉCNICO com uma linha em linguagem simples que o nutricionista possa repassar ao paciente explicando qualquer ajuste feito por segurança."
  );
  linhas.push("");
  return linhas.join("\n");
}
