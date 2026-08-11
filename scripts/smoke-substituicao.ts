// Smoke de integração do motor de substituição no system prompt do chat.
// Confirma que o módulo + filtros só entram quando há plano vigente.
import { montarSystemPromptChat } from "../src/lib/prompt";

const anamnese = {
  objetivo: "manutencao",
  comportamento: {
    intolerancias: ["lactose"],
    alimentosQueNaoGosta: ["fígado"],
    orcamento: "econômico",
  },
  saude: {
    diagnosticos: ["doença renal crônica estágio 4"],
    medicacoes: ["losartana"],
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const ctxComPlano: any = {
  cliente: { nome: "Marta", consentimentoLgpd: true, consentimentoFotos: false },
  caso: { memoria: JSON.stringify({ anamnese }) },
  dietaLiberada: {
    ciclo: 1,
    liberadoEm: new Date(),
    conteudo: "*CARDÁPIO*\nAlmoço: arroz, feijão, frango 120g",
  },
  dietaPendente: false,
};
const ctxSemPlano: any = { ...ctxComPlano, dietaLiberada: null };

const comPlano = montarSystemPromptChat(ctxComPlano);
const semPlano = montarSystemPromptChat(ctxSemPlano);

const check = (label: string, cond: boolean) =>
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);

console.log("COM plano vigente:");
check("módulo de substituição injetado", comPlano.includes("MOTOR DE SUBSTITUIÇÃO INTELIGENTE"));
check("bloco de filtros injetado", comPlano.includes("FILTROS DE SUBSTITUIÇÃO ATIVOS"));
check("intolerância (lactose) no contexto", comPlano.toLowerCase().includes("lactose"));
check("teto de potássio (DRC) no contexto", comPlano.toLowerCase().includes("potassio"));
check("alerta de revisão do nutricionista", comPlano.includes("revisão do nutricionista"));

console.log("SEM plano vigente (só anamnese):");
check("módulo NÃO injetado", !semPlano.includes("MOTOR DE SUBSTITUIÇÃO INTELIGENTE"));
check("filtros NÃO injetados", !semPlano.includes("FILTROS DE SUBSTITUIÇÃO ATIVOS"));
