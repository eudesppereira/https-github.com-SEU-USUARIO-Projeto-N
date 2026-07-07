import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { auditar } from "@/lib/audit";

// Exclusão de dados (LGPD, direito do titular). Apaga cliente, casos, dietas,
// check-ins e mensagens (cascade). O registro fica apenas na Auditoria.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente)
    return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });

  await prisma.cliente.delete({ where: { id } });
  await auditar("exclusao", {
    clienteId: id,
    email: cliente.email,
    em: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
