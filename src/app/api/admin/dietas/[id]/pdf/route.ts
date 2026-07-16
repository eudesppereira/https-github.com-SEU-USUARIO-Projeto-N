import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { gerarDietaPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await params;
  const dieta = await prisma.dieta.findUnique({
    where: { id },
    include: { caso: { include: { cliente: true } } },
  });
  if (!dieta || dieta.status !== "liberado")
    return NextResponse.json({ erro: "PDF ainda não disponível" }, { status: 409 });

  // dietas liberadas antes do PDF existir (ou fora do fluxo normal de
  // liberação) não têm pdfDados salvo — gera na hora e persiste, sem quebrar.
  let pdfDados = dieta.pdfDados;
  if (!pdfDados) {
    const buffer = await gerarDietaPdf({
      clienteNome: dieta.caso.cliente.nome,
      ciclo: dieta.ciclo,
      dataLiberacao: dieta.liberadoEm ?? dieta.criadoEm,
      conteudo: dieta.conteudo,
    });
    pdfDados = buffer.toString("base64");
    await prisma.dieta.update({ where: { id: dieta.id }, data: { pdfDados } });
  }

  const buffer = Buffer.from(pdfDados, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="plano-alimentar-ciclo-${dieta.ciclo}.pdf"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
