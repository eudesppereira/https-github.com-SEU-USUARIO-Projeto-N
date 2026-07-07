// Processamento server-side dos eventos emitidos pelo modelo no chat.
// Cada handler é idempotente na medida do possível; falha de um handler não
// derruba a resposta ao cliente (loga e segue).

import type { Cliente } from "@prisma/client";
import { prisma } from "./db";
import { auditar } from "./audit";
import type { EventoNutre } from "./eventos";
import {
  calcularPerfilMetabolico,
  type Objetivo,
  type Sexo,
} from "./calculos";
import { flagsDeterministicas, unirFlags, lerMemoria, type MemoriaCaso } from "./caso";
import { gerarDietaParaRevisao } from "./dieta";

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

const FATORES_VALIDOS = [1.2, 1.375, 1.55, 1.725, 1.9];

function normalizarFator(bruto: unknown): number {
  const n = Number(bruto);
  if (!Number.isFinite(n)) return 1.2;
  // valor fora da lista → o mais próximo (na dúvida o prompt já manda o menor)
  return FATORES_VALIDOS.reduce((melhor, f) =>
    Math.abs(f - n) < Math.abs(melhor - n) ? f : melhor
  );
}

function normalizarObjetivo(bruto: unknown): Objetivo {
  const s = String(bruto ?? "").toLowerCase();
  if (s.includes("emagre")) return "emagrecimento";
  if (s.includes("ganho") || s.includes("massa")) return "ganho";
  if (s.includes("perform")) return "performance";
  return "manutencao";
}

async function processarEvento(evento: EventoNutre, cliente: Cliente): Promise<void> {
  switch (evento.tipo) {
    case "consentimento_lgpd":
    case "consentimento_fotos":
      // implementado na etapa de LGPD (commit 7)
      break;

    case "anamnese_completa":
      await tratarAnamneseCompleta(evento.payload, cliente);
      break;

    case "checkin":
    case "retorno":
      // implementado na etapa de check-in/retorno (commit 6)
      break;

    case "solicitacao_exclusao":
      // implementado na etapa de LGPD (commit 7)
      break;
  }
}

async function tratarAnamneseCompleta(
  payload: Record<string, unknown>,
  cliente: Cliente
): Promise<void> {
  const sexo: Sexo = payload.sexo === "feminino" ? "feminino" : "masculino";
  const idade = Number(payload.idade);
  const pesoKg = Number(payload.pesoKg);
  const alturaCm = Number(payload.alturaCm);
  if (![idade, pesoKg, alturaCm].every(Number.isFinite) || pesoKg <= 0 || alturaCm <= 0) {
    console.error("[nutre] anamnese_completa com dados inválidos — ignorando", payload);
    return;
  }

  const objetivo = normalizarObjetivo(payload.objetivo);
  const fatorAtividade = normalizarFator(payload.fatorAtividade);

  const perfil = calcularPerfilMetabolico({
    sexo,
    idade,
    pesoKg,
    alturaCm,
    fatorAtividade,
    objetivo,
  });

  const flags = unirFlags(payload.flags, flagsDeterministicas(payload));

  const memoria: MemoriaCaso = {
    anamnese: payload,
    medidasBaseline: (payload.medidas ?? {}) as Record<string, number>,
    pesoBaselineKg: pesoKg,
    flags,
    perfilMetabolico: perfil,
    metaCalorica: perfil.metaCalorica,
    macros: perfil.macros,
    ultimoPesoKg: pesoKg,
    ultimasMedidas: (payload.medidas ?? {}) as Record<string, number>,
    ultimoRegistroEm: new Date().toISOString(),
    historicoIndice: [],
    pedidosDeMudanca: [],
  };

  // reaproveita caso aberto sem anamnese (não duplica se o modelo reemitir o evento)
  let caso = await prisma.caso.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });
  if (caso && lerMemoria(caso.memoria).anamnese) {
    const jaTemDieta = await prisma.dieta.count({ where: { casoId: caso.id } });
    if (jaTemDieta > 0) {
      console.warn("[nutre] anamnese_completa duplicada — ignorando");
      return;
    }
  }
  if (caso) {
    caso = await prisma.caso.update({
      where: { id: caso.id },
      data: { memoria: JSON.stringify(memoria) },
    });
  } else {
    caso = await prisma.caso.create({
      data: { clienteId: cliente.id, memoria: JSON.stringify(memoria) },
    });
  }

  // Geração em chamada separada — o resultado NUNCA aparece no chat:
  // entra na fila do nutricionista com status pendente_revisao.
  await gerarDietaParaRevisao({ caso, cliente, ciclo: 1 });
}
