import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    nome?: string;
    email?: string;
    telefone?: string;
  };
  const nome = body.nome?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!nome || !email)
    return NextResponse.json({ erro: "nome e e-mail são obrigatórios" }, { status: 400 });

  const existente = await prisma.cliente.findUnique({ where: { email } });
  if (existente)
    return NextResponse.json({ erro: "já existe cliente com esse e-mail" }, { status: 409 });

  const token = crypto.randomBytes(24).toString("base64url");
  const cliente = await prisma.cliente.create({
    data: { nome, email, telefone: body.telefone?.trim() || null, token },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    ok: true,
    clienteId: cliente.id,
    link: `${base}/c/${token}`,
  });
}
