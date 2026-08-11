import fs from "fs";
import path from "path";
import type { Cliente, Caso, Dieta } from "@prisma/client";
import { lerMemoria, diasDesde, DIAS_CICLO } from "./caso";
import { montarBlocoFiltros } from "./substituicao";

function lerPromptArquivo(nome: string): string {
  return fs.readFileSync(path.join(process.cwd(), "prompts", nome), "utf8");
}

let baseCache: string | null = null;
let substituicaoCache: string | null = null;

// Módulo de substituição de alimentos — anexado ao contexto SOMENTE quando há
// plano vigente (a troca só faz sentido contra uma dieta já liberada).
function moduloSubstituicao(): string {
  if (!substituicaoCache) {
    substituicaoCache = lerPromptArquivo("nutre-ai-substituicao.md");
  }
  return substituicaoCache;
}

// Base estática: prompt v2 adaptado + camada de restrições (seções 3, 4 e 6)
export function promptBase(): string {
  if (!baseCache) {
    baseCache =
      lerPromptArquivo("nutre-ai-prompt-v2.md") +
      "\n\n---\n\n" +
      lerPromptArquivo("nutre-ai-restricoes.md");
  }
  return baseCache;
}

export interface ContextoChat {
  cliente: Cliente;
  caso: Caso | null;
  dietaLiberada: Dieta | null; // APENAS dietas com status "liberado" — gate no chamador
  dietaPendente: boolean; // existe dieta pendente_revisao/devolvida (cliente vê "em revisão")
}

// Bloco dinâmico com o estado do caso. NUNCA inclui dieta não-liberada.
export function blocoEstado(ctx: ContextoChat): string {
  const { cliente, caso, dietaLiberada, dietaPendente } = ctx;
  const linhas: string[] = [
    "## ESTADO ATUAL DO CASO (injetado pelo sistema — fonte da verdade)",
    "",
    `Cliente: ${cliente.nome}`,
    `Consentimento LGPD registrado: ${cliente.consentimentoLgpd ? "SIM" : "NÃO — obrigatório antes de qualquer coleta (Etapa 0)"}`,
    `Consentimento de fotos registrado: ${cliente.consentimentoFotos ? "SIM" : "não"}`,
  ];

  if (!caso) {
    linhas.push(
      "",
      "Fase: PRIMEIRA AVALIAÇÃO — conduza a entrevista (Etapas 0 a 9). Nenhuma anamnese registrada ainda."
    );
    return linhas.join("\n");
  }

  const memoria = lerMemoria(caso.memoria);

  if (memoria.anamnese) {
    linhas.push(
      "",
      "### MEMÓRIA DO CASO",
      "```json",
      JSON.stringify(
        {
          anamnese: memoria.anamnese,
          medidasBaseline: memoria.medidasBaseline,
          pesoBaselineKg: memoria.pesoBaselineKg,
          flags: memoria.flags,
          metaCalorica: memoria.metaCalorica,
          macros: memoria.macros,
          ultimoPesoKg: memoria.ultimoPesoKg,
          ultimasMedidas: memoria.ultimasMedidas,
          ultimoRegistroEm: memoria.ultimoRegistroEm,
          pedidosDeMudanca: memoria.pedidosDeMudanca,
        },
        null,
        2
      ),
      "```"
    );
  } else {
    linhas.push("", "Fase: ENTREVISTA EM ANDAMENTO — retome de onde parou, nunca recomece do zero.");
  }

  if (dietaLiberada) {
    const dias = diasDesde(dietaLiberada.liberadoEm) ?? 0;
    const cicloCompleto = dias >= DIAS_CICLO;
    linhas.push(
      "",
      `### PLANO VIGENTE (ciclo ${dietaLiberada.ciclo}, LIBERADO pelo nutricionista há ${dias} dia(s))`,
      "O plano abaixo foi liberado e entregue — você pode discuti-lo, tirar dúvidas e usá-lo nos comparativos:",
      "",
      dietaLiberada.conteudo,
      "",
      `Ciclo mensal completo: ${cicloCompleto ? "SIM — se o cliente trouxer dados novos, conduza o RETORNO MENSAL (evento retorno)" : `NÃO — faltam ~${DIAS_CICLO - dias} dia(s); dados novos são CHECK-IN (evento checkin), nunca retorno`}`
    );

    // Com plano vigente, habilita o motor de substituição: o módulo de prompt +
    // os filtros de segurança já casados com a ficha do paciente.
    linhas.push(
      "",
      "---",
      "",
      moduloSubstituicao(),
      "",
      "---",
      "",
      montarBlocoFiltros(memoria.anamnese ?? {})
    );
  }

  if (dietaPendente) {
    linhas.push(
      "",
      "### DIETA EM REVISÃO",
      "Há um plano na fila de revisão do nutricionista. Ao cliente: o plano está em revisão profissional e será entregue aqui assim que liberado. NÃO especule sobre conteúdo, números ou prazos além de 24–48h."
    );
  }

  if (!dietaLiberada && !dietaPendente && memoria.anamnese) {
    linhas.push(
      "",
      "Fase: anamnese concluída, aguardando processamento do sistema."
    );
  }

  return linhas.join("\n");
}

export function montarSystemPromptChat(ctx: ContextoChat): string {
  return promptBase() + "\n\n---\n\n" + blocoEstado(ctx);
}
