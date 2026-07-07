// Processamento server-side dos eventos emitidos pelo modelo no chat.
// Cada handler é idempotente na medida do possível; falha de um handler não
// derruba a resposta ao cliente (loga e segue).

import type { Cliente } from "@prisma/client";
import { prisma } from "./db";
import { auditar } from "./audit";
import type { EventoNutre } from "./eventos";

export async function processarEventos(
  eventos: EventoNutre[],
  cliente: Cliente
): Promise<void> {
  for (const evento of eventos) {
    try {
      await processarEvento(evento, cliente);
    } catch (e) {
      console.error(`[nutre] erro ao processar evento ${evento.tipo}:`, e);
    }
  }
}

async function processarEvento(evento: EventoNutre, cliente: Cliente): Promise<void> {
  switch (evento.tipo) {
    case "consentimento_lgpd":
    case "consentimento_fotos":
      // implementado na etapa de LGPD (commit 7)
      break;
    case "anamnese_completa":
      // implementado na etapa de geração de dieta (commit 4)
      break;
    case "checkin":
    case "retorno":
      // implementado na etapa de check-in/retorno (commit 6)
      break;
    case "solicitacao_exclusao":
      // implementado na etapa de LGPD (commit 7)
      break;
  }
  void prisma;
  void auditar;
  void cliente;
}
