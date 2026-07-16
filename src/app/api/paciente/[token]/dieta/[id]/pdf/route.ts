import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gerarDietaPdf } from "@/lib/pdf";

export const runtime = "nodejs";

// PDF do plano liberado — acesso pelo mesmo token mágico usado no painel/chat
// do paciente (sem sessão extra), igual ao padrão das outras rotas /api/paciente/[token]/*.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  const dieta = await prisma.dieta.findUnique({
    where: { id },
    include: { caso: true },
  });
  if (!dieta || dieta.caso.clienteId !== cliente.id)
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  if (dieta.status !== "liberado")
    return NextResponse.json({ erro: "PDF ainda não disponível" }, { status: 409 });

  // dietas liberadas antes do PDF existir (ou fora do fluxo normal de
  // liberação) não têm pdfDados salvo — gera na hora e persiste, sem quebrar.
  let pdfDados = dieta.pdfDados;
  if (!pdfDados) {
    const buffer = await gerarDietaPdf({
      clienteNome: cliente.nome,
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
