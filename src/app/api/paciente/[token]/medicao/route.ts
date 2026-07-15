import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { casoAtualDoCliente } from "@/lib/paciente";

// Paciente anota peso/medidas no painel (não gera dieta; é acompanhamento).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    peso?: number | string;
    medidas?: Record<string, number | string>;
    observacao?: string;
  };
  const peso = Number(body.peso);
  if (!Number.isFinite(peso) || peso <= 0)
    return NextResponse.json({ erro: "informe um peso válido" }, { status: 400 });

  // normaliza medidas para números
  const medidas: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.medidas ?? {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) medidas[k] = n;
  }

  let caso = await casoAtualDoCliente(cliente.id);
  if (!caso) {
    caso = await prisma.caso.create({ data: { clienteId: cliente.id, memoria: "{}" } });
  }

  await prisma.checkin.create({
    data: {
      casoId: caso.id,
      peso,
      medidas: JSON.stringify(medidas),
      adesao: null,
      origem: "painel",
      observacao: body.observacao?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
