// Motor de substituição de alimentos: transforma a ficha do paciente no bloco
// "FILTROS DE SUBSTITUIÇÃO ATIVOS" que o módulo `nutre-ai-substituicao.md`
// consome no chat. Reaproveita o motor de conduta clínica (mesma base de 50
// doenças + interações fármaco-nutriente), de modo que a lista de substituição
// herda EXATAMENTE as mesmas travas de segurança da geração de dieta — não há
// um segundo motor de regras para manter em sincronia.
//
// Só é injetado quando há PLANO VIGENTE (dieta liberada). Para paciente sem
// nenhuma comorbidade/restrição, ainda assim monta um bloco enxuto com as
// travas de coerência de refeição, aversões e praticidade.

import { detectarCondicoes } from "./conduta-clinica";

function coletarTextos(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.flatMap(coletarTextos);
  if (typeof valor === "object") {
    return Object.values(valor as Record<string, unknown>).flatMap(coletarTextos);
  }
  const s = String(valor).trim();
  return s ? [s] : [];
}

function listaLimpa(valor: unknown): string[] {
  // dedup preservando ordem, ignorando vazios
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of coletarTextos(valor)) {
    const chave = t.toLowerCase();
    if (!vistos.has(chave)) {
      vistos.add(chave);
      out.push(t);
    }
  }
  return out;
}

export interface FiltrosSubstituicao {
  alergiasIntolerancias: string[];
  aversoes: string[];
  preferencias: string[];
  vetosClinicos: string[]; // "evitar" das condições ativas
  tetosClinicos: string[]; // hard_constraints legíveis
  interacoesFarmaco: string[];
  praticidade: string[];
  temTravaClinica: boolean;
}

// Extrai, de forma determinística, os filtros que a lista de substituição deve
// respeitar. Não decide substitutos (isso é papel do modelo com o módulo de
// prompt) — apenas consolida as travas para injeção no contexto.
export function extrairFiltros(anamnese: Record<string, unknown>): FiltrosSubstituicao {
  const comportamento = (anamnese.comportamento ?? {}) as Record<string, unknown>;

  const alergiasIntolerancias = listaLimpa([
    comportamento.intolerancias,
    comportamento.restricoes,
  ]);
  const aversoes = listaLimpa(comportamento.alimentosQueNaoGosta);
  const preferencias = listaLimpa([
    comportamento.preferencias,
    comportamento.alimentosQueGosta,
  ]);

  const { doencas, interacoes, temContextoClinico } = detectarCondicoes(anamnese);

  const vetosClinicos = listaLimpa(doencas.flatMap((d) => d.evitar));

  const tetosClinicos: string[] = [];
  for (const d of doencas) {
    for (const h of d.hard_constraints) {
      const alvo = h.nutriente ?? h.interacao ?? "?";
      const limite =
        h.max != null ? `≤${h.max}` : h.min != null ? `≥${h.min}` : h.valor ?? "";
      const cond = h.condicional ? ` (${h.condicional})` : "";
      tetosClinicos.push(`${alvo} ${limite}${cond} — ${h.motivo} [${d.nome}]`);
    }
  }

  const interacoesFarmaco = interacoes.map(
    (it) => `${it.medicamento} × ${it.nutriente}: ${it.regra} (risco: ${it.risco})`
  );

  const praticidade: string[] = [];
  const orcamento = String(comportamento.orcamento ?? "").trim();
  if (orcamento) praticidade.push(`Orçamento: ${orcamento}`);
  const tempo = Number(comportamento.tempoPreparoMin);
  if (Number.isFinite(tempo) && tempo > 0) praticidade.push(`Tempo de preparo: ~${tempo} min`);
  if (comportamento.cozinha === false) praticidade.push("Não cozinha — prefira montagem sem preparo");
  if (comportamento.refrigeracao === false) praticidade.push("Sem refrigeração — evite perecíveis");

  return {
    alergiasIntolerancias,
    aversoes,
    preferencias,
    vetosClinicos,
    tetosClinicos,
    interacoesFarmaco,
    praticidade,
    temTravaClinica: temContextoClinico,
  };
}

function secao(titulo: string, itens: string[], prefixo = "- "): string[] {
  if (itens.length === 0) return [];
  return [`### ${titulo}`, ...itens.map((i) => `${prefixo}${i}`), ""];
}

// Monta o bloco de texto injetado no system prompt do chat. Sempre retorna um
// bloco (mesmo para paciente saudável) porque a substituição também depende de
// aversões, preferências e coerência de refeição — não só de travas clínicas.
export function montarBlocoFiltros(anamnese: Record<string, unknown>): string {
  const f = extrairFiltros(anamnese);
  const linhas: string[] = [
    "## FILTROS DE SUBSTITUIÇÃO ATIVOS (injetado pelo sistema — aplique no módulo de substituição)",
    "",
    "Travas já casadas com a ficha do paciente. Não recalcule; aplique na Camada A/B do módulo de substituição.",
    "",
  ];

  if (f.temTravaClinica) {
    linhas.push(
      "⚠️ Paciente COM condição clínica e/ou interação medicamentosa: toda troca de risco sai com **revisão do nutricionista**.",
      ""
    );
  }

  linhas.push(
    ...secao("A1 · Alergias / intolerâncias (veto absoluto)", f.alergiasIntolerancias),
    ...secao("A2 · Vetos clínicos por comorbidade (evitar)", f.vetosClinicos),
    ...secao("A2 · Tetos clínicos invioláveis", f.tetosClinicos),
    ...secao("A2 · Interações fármaco-nutriente", f.interacoesFarmaco),
    ...secao("A5 · Aversões (elimina o candidato)", f.aversoes),
    ...secao("A5 · Preferências (aumenta a prioridade)", f.preferencias),
    ...secao("A4 · Praticidade e acesso", f.praticidade)
  );

  const semTravas =
    f.alergiasIntolerancias.length === 0 &&
    f.vetosClinicos.length === 0 &&
    f.tetosClinicos.length === 0 &&
    f.interacoesFarmaco.length === 0 &&
    f.aversoes.length === 0;
  if (semTravas) {
    linhas.push(
      "### Sem travas de segurança ou aversões registradas",
      "- Aplique coerência de refeição (A3), praticidade (A4) e preferências; foque em equivalência nutricional e variedade.",
      ""
    );
  }

  return linhas.join("\n").trimEnd();
}
