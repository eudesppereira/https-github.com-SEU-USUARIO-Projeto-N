// Processamento server-side dos eventos emitidos pelo modelo no chat.
// Cada handler é idempotente na medida do possível; falha de um handler não
// derruba a resposta ao cliente (loga e segue).

import type { Caso, Cliente } from "@prisma/client";
import { prisma } from "./db";
import { auditar } from "./audit";
import type { EventoNutre } from "./eventos";
import {
  avaliarEvolucaoFisica,
  calcularIndiceProgressao,
  calcularPerfilMetabolico,
  type Objetivo,
  type Sexo,
} from "./calculos";
import {
  DIAS_CICLO,
  diasDesde,
  flagsDeterministicas,
  unirFlags,
  lerMemoria,
  type MemoriaCaso,
} from "./caso";
import { gerarDietaParaRevisao } from "./dieta";
import { resolverEnergia } from "./dri/perfil-dri";

export async function processarEventos(
  eventos: EventoNutre[],
  cliente: Cliente,
  textoResposta = ""
): Promise<void> {
  for (const evento of eventos) {
    try {
      await processarEvento(evento, cliente, textoResposta);
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

async function processarEvento(
  evento: EventoNutre,
  cliente: Cliente,
  textoResposta: string
): Promise<void> {
  switch (evento.tipo) {
    case "consentimento_lgpd":
      await tratarConsentimento(evento.payload, cliente, "lgpd");
      break;

    case "consentimento_fotos":
      await tratarConsentimento(evento.payload, cliente, "fotos");
      break;

    case "anamnese_completa":
      await tratarAnamneseCompleta(evento.payload, cliente);
      break;

    case "checkin":
      await tratarRegistroEvolucao(evento.payload, cliente, textoResposta, false);
      break;

    case "retorno":
      await tratarRegistroEvolucao(evento.payload, cliente, textoResposta, true);
      break;

    case "solicitacao_exclusao":
      await tratarSolicitacaoExclusao(cliente);
      break;
  }
}

// Consentimentos LGPD (art. 11 — dado sensível: específico, destacado, com registro)
async function tratarConsentimento(
  payload: Record<string, unknown>,
  cliente: Cliente,
  tipo: "lgpd" | "fotos"
): Promise<void> {
  const aceitou = String(payload.resposta ?? "").toLowerCase().startsWith("s");
  const agora = new Date();
  await prisma.cliente.update({
    where: { id: cliente.id },
    data:
      tipo === "lgpd"
        ? { consentimentoLgpd: aceitou, consentimentoLgpdEm: agora }
        : { consentimentoFotos: aceitou, consentimentoFotosEm: agora },
  });
  await auditar(tipo === "lgpd" ? "consentimento_lgpd" : "consentimento_fotos", {
    clienteId: cliente.id,
    resposta: aceitou ? "sim" : "nao",
    em: agora.toISOString(),
  });
}

// Pedido de exclusão vindo do chat: registra, pausa o uso e aciona o nutricionista
// (a exclusão efetiva é feita pelo admin no painel).
async function tratarSolicitacaoExclusao(cliente: Cliente): Promise<void> {
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { status: "pausado" },
  });
  await auditar("exclusao_solicitada", {
    clienteId: cliente.id,
    email: cliente.email,
    em: new Date().toISOString(),
  });
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

  // Fonte de energia conforme a política: adulto mantém o Mifflin GET
  // (padrão-ouro); idoso e criança/adolescente usam a EER da DRI.
  const energia = resolverEnergia({ sexo, idadeAnos: idade, pesoKg, alturaCm, fatorAtividade });

  const perfil = calcularPerfilMetabolico(
    { sexo, idade, pesoKg, alturaCm, fatorAtividade, objetivo },
    energia.metodo === "eer_dri" && energia.eerKcal != null
      ? { getOverride: energia.eerKcal, metodoEnergia: "eer_dri", avisoEnergia: energia.aviso }
      : { metodoEnergia: "mifflin_get", avisoEnergia: energia.aviso }
  );

  // aviso de energia (ex.: deposição de crescimento) vira flag de revisão
  const flagsBase = unirFlags(payload.flags, flagsDeterministicas(payload));
  const flags = energia.aviso ? unirFlags(flagsBase, [energia.aviso]) : flagsBase;

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

// Check-in (comparativo, sem dieta nova) e retorno mensal (gera dieta do próximo ciclo).
async function tratarRegistroEvolucao(
  payload: Record<string, unknown>,
  cliente: Cliente,
  textoResposta: string,
  ehRetorno: boolean
): Promise<void> {
  const caso: Caso | null = await prisma.caso.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });
  if (!caso) {
    console.warn("[nutre] checkin/retorno sem caso — ignorando");
    return;
  }
  const memoria = lerMemoria(caso.memoria);
  if (!memoria.anamnese || !memoria.perfilMetabolico) {
    console.warn("[nutre] checkin/retorno sem anamnese — ignorando");
    return;
  }

  const pesoKg = Number(payload.pesoKg);
  const adesao = Math.min(Math.max(Number(payload.adesao) || 0, 0), 10);
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    console.warn("[nutre] checkin/retorno com peso inválido — ignorando");
    return;
  }
  const medidas = (payload.medidas ?? {}) as Record<string, number>;

  // evolução vs. esperado para o objetivo
  const objetivo = normalizarObjetivo(
    (memoria.anamnese as Record<string, unknown>).objetivo
  );
  const ultimoRegistro = memoria.ultimoRegistroEm
    ? new Date(memoria.ultimoRegistroEm)
    : null;
  const semanas = ultimoRegistro
    ? Math.max((Date.now() - ultimoRegistro.getTime()) / (7 * 86400000), 0.5)
    : 1;
  const evolucao = avaliarEvolucaoFisica(
    objetivo,
    memoria.pesoBaselineKg ?? pesoKg,
    memoria.ultimoPesoKg ?? pesoKg,
    pesoKg,
    semanas
  );

  // consistência: registros nos últimos 30 dias (este incluso) vs. 2 esperados (check-in + retorno)
  const registros30d = await prisma.checkin.count({
    where: { casoId: caso.id, data: { gte: new Date(Date.now() - 30 * 86400000) } },
  });
  const indice = calcularIndiceProgressao(adesao, evolucao, registros30d + 1, 2);

  await prisma.checkin.create({
    data: {
      casoId: caso.id,
      peso: pesoKg,
      medidas: JSON.stringify(medidas),
      adesao,
      dificuldades: typeof payload.dificuldades === "string" ? payload.dificuldades : null,
      comparativo: textoResposta || null,
    },
  });

  const pedidos = [...(memoria.pedidosDeMudanca ?? [])];
  if (typeof payload.pedidosDeMudanca === "string" && payload.pedidosDeMudanca.trim()) {
    pedidos.push(payload.pedidosDeMudanca.trim());
  }

  const novaMemoria: MemoriaCaso = {
    ...memoria,
    ultimoPesoKg: pesoKg,
    ultimasMedidas: { ...(memoria.ultimasMedidas ?? {}), ...medidas },
    ultimoRegistroEm: new Date().toISOString(),
    indiceProgressao: indice,
    historicoIndice: [
      ...(memoria.historicoIndice ?? []),
      { data: new Date().toISOString(), indice },
    ],
    pedidosDeMudanca: pedidos,
  };
  await prisma.caso.update({
    where: { id: caso.id },
    data: { memoria: JSON.stringify(novaMemoria) },
  });

  if (!ehRetorno) return; // check-in NUNCA gera dieta nova

  // defesa em código: retorno só gera dieta se o ciclo realmente fechou
  const ultimaLiberada = await prisma.dieta.findFirst({
    where: { casoId: caso.id, status: "liberado" },
    orderBy: { ciclo: "desc" },
  });
  const dias = diasDesde(ultimaLiberada?.liberadoEm);
  if (!ultimaLiberada || dias === null || dias < DIAS_CICLO) {
    console.warn(
      `[nutre] evento retorno fora do ciclo (dias=${dias}) — registrado como check-in, sem dieta nova`
    );
    return;
  }
  // não duplicar se já existe dieta em revisão
  const emRevisao = await prisma.dieta.count({
    where: { casoId: caso.id, status: "pendente_revisao" },
  });
  if (emRevisao > 0) {
    console.warn("[nutre] retorno com dieta já em revisão — não gera outra");
    return;
  }

  const casoAtualizado = await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } });
  await gerarDietaParaRevisao({
    caso: casoAtualizado,
    cliente,
    ciclo: ultimaLiberada.ciclo + 1,
  });
}
