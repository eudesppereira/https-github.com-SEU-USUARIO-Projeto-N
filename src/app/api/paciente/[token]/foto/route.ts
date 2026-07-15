import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { casoAtualDoCliente } from "@/lib/paciente";

const MAX_BYTES = 6 * 1024 * 1024; // ~6MB por foto (data URI)

// Upload de foto de evolução pelo paciente. Registra consentimento de fotos.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    dados?: string; // data URI base64
    angulo?: string;
  };
  const dados = body.dados;
  if (!dados || !dados.startsWith("data:image/"))
    return NextResponse.json({ erro: "imagem inválida" }, { status: 400 });
  if (dados.length > MAX_BYTES)
    return NextResponse.json({ erro: "imagem muito grande (máx. ~4MB)" }, { status: 413 });

  let caso = await casoAtualDoCliente(cliente.id);
  if (!caso) caso = await prisma.caso.create({ data: { clienteId: cliente.id, memoria: "{}" } });

  await prisma.foto.create({
    data: {
      casoId: caso.id,
      dados,
      angulo: body.angulo?.trim() || null,
      origem: "painel",
    },
  });

  // consentimento de fotos: enviar a foto é o consentimento explícito de uso p/ avaliação
  if (!cliente.consentimentoFotos) {
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { consentimentoFotos: true, consentimentoFotosEm: new Date() },
    });
    await auditar("consentimento_fotos", {
      clienteId: cliente.id,
      resposta: "sim",
      origem: "upload_painel",
      em: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
