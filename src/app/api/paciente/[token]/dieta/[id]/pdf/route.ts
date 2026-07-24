import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { obterPdfAtualizado } from "@/lib/pdf-cache";

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

  // Regenera quando o cache está vazio ou foi salvo por um template antigo —
  // dietas liberadas antes do redesign passam a entregar o padrão atual.
  const buffer = await obterPdfAtualizado(dieta.id, dieta.pdfDados, {
    clienteNome: cliente.nome,
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
