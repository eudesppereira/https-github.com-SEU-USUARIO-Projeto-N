import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { auditar } from "@/lib/audit";
import { gerarDietaParaRevisao } from "@/lib/dieta";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { instrucoes?: string };
  const instrucoes = body.instrucoes?.trim();
  if (!instrucoes)
    return NextResponse.json({ erro: "informe as instruções de ajuste" }, { status: 400 });

  const dieta = await prisma.dieta.findUnique({
    where: { id },
    include: { caso: { include: { cliente: true } } },
  });
  if (!dieta) return NextResponse.json({ erro: "dieta não encontrada" }, { status: 404 });
  if (dieta.status !== "pendente_revisao")
    return NextResponse.json(
      { erro: `dieta com status "${dieta.status}" não pode ser devolvida` },
      { status: 409 }
    );

  await prisma.dieta.update({
    where: { id },
    data: { status: "devolvido", notasDoNutricionista: instrucoes },
  });
  await auditar("devolucao", {
    dietaId: id,
    casoId: dieta.casoId,
    clienteId: dieta.caso.clienteId,
    ciclo: dieta.ciclo,
    instrucoes,
  });

  // regenera com as instruções — a nova proposta volta à fila
  const resultado = await gerarDietaParaRevisao({
    caso: dieta.caso,
    cliente: dieta.caso.cliente,
    ciclo: dieta.ciclo,
    instrucoesExtra: instrucoes,
  });

  return NextResponse.json({
    ok: true,
    novaDietaId: resultado.dieta.id,
    validacaoOk: resultado.validacaoOk,
  });
}
