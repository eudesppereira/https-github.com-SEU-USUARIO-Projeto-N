import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic, MODELO } from "@/lib/anthropic";
import { montarSystemPromptChat } from "@/lib/prompt";
import { extrairEventos } from "@/lib/eventos";
import { processarEventos } from "@/lib/handlers";

const MAX_HISTORICO = 60; // mensagens enviadas ao modelo

async function carregarContexto(token: string) {
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return null;

  const caso = await prisma.caso.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });

  let dietaLiberada = null;
  let dietaPendente = false;
  if (caso) {
    // GATE DE SEGURANÇA: apenas dietas com status "liberado" entram no contexto do modelo
    dietaLiberada = await prisma.dieta.findFirst({
      where: { casoId: caso.id, status: "liberado" },
      orderBy: { ciclo: "desc" },
    });
    dietaPendente =
      (await prisma.dieta.count({
        where: { casoId: caso.id, status: { in: ["pendente_revisao", "devolvido", "rascunho"] } },
      })) > 0;
  }
  return { cliente, caso, dietaLiberada, dietaPendente };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const mensagens = await prisma.mensagem.findMany({
    where: { clienteId: cliente.id },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json({
    mensagens: mensagens.map((m) => ({ id: m.id, role: m.role, conteudo: m.conteudo })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ctx = await carregarContexto(token);
  if (!ctx) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const { cliente } = ctx;

  if (cliente.status === "pausado") {
    return NextResponse.json(
      { erro: "Acompanhamento pausado. Fale com o nutricionista para retomar." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    mensagem?: string;
    inicio?: boolean;
    retry?: boolean;
  };

  const historico = await prisma.mensagem.findMany({
    where: { clienteId: cliente.id },
    orderBy: { timestamp: "asc" },
  });

  let mensagensModelo: { role: "user" | "assistant"; content: string }[];

  if (body.inicio) {
    if (historico.length > 0) {
      // chat já iniciado — nada a fazer
      return NextResponse.json({ mensagens: [] });
    }
    mensagensModelo = [
      {
        role: "user",
        content:
          "[SISTEMA: o cliente acabou de abrir o chat pela primeira vez. Inicie a Etapa 0 — boas-vindas e consentimento LGPD.]",
      },
    ];
  } else if (body.retry) {
    // reenvio: a mensagem do usuário já foi salva na tentativa anterior (que
    // falhou só na resposta do modelo) — não duplica, só tenta gerar de novo
    // em cima do histórico que já termina nela.
    if (historico.length === 0 || historico[historico.length - 1].role !== "user") {
      return NextResponse.json({ erro: "nada para reenviar" }, { status: 400 });
    }
    mensagensModelo = historico
      .slice(-MAX_HISTORICO)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.conteudo }));
  } else {
    const texto = (body.mensagem ?? "").trim();
    if (!texto) return NextResponse.json({ erro: "mensagem vazia" }, { status: 400 });
    if (texto.length > 4000)
      return NextResponse.json({ erro: "mensagem longa demais" }, { status: 400 });
    await prisma.mensagem.create({
      data: { clienteId: cliente.id, role: "user", conteudo: texto },
    });
    mensagensModelo = [
      ...historico.slice(-MAX_HISTORICO).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.conteudo,
      })),
      { role: "user" as const, content: texto },
    ];
  }

  const system = montarSystemPromptChat(ctx);

  let respostaBruta: string;
  try {
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system,
      messages: mensagensModelo,
    });
    respostaBruta = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
  } catch (e) {
    console.error("[nutre] erro na API Anthropic:", e);
    return NextResponse.json(
      { erro: "Não consegui responder agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }

  const { textoLimpo, eventos } = extrairEventos(respostaBruta);

  // eventos primeiro: se a anamnese fechar, a dieta é gerada antes de o cliente ver a resposta
  await processarEventos(eventos, cliente, textoLimpo);

  const salva = await prisma.mensagem.create({
    data: {
      clienteId: cliente.id,
      role: "assistant",
      conteudo: textoLimpo || "…",
    },
  });

  return NextResponse.json({
    mensagens: [{ id: salva.id, role: "assistant", conteudo: salva.conteudo }],
  });
}
