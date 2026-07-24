import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { obterPdfAtualizado } from "@/lib/pdf-cache";

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

  // Regenera quando o cache está vazio ou foi salvo por um template antigo —
  // dietas liberadas antes do redesign passam a entregar o padrão atual.
  const buffer = await obterPdfAtualizado(dieta.id, dieta.pdfDados, {
    clienteNome: dieta.caso.cliente.nome,
    ciclo: dieta.ciclo,
    dataLiberacao: dieta.liberadoEm ?? dieta.criadoEm,
    conteudo: dieta.conteudo,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="plano-alimentar-ciclo-${dieta.ciclo}.pdf"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
