import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    nome?: string;
    email?: string;
    telefone?: string;
    idade?: number | string;
    cidade?: string;
    ocupacao?: string;
    rendaMensal?: string;
    senha?: string;
  };
  const nome = body.nome?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!nome || !email)
    return NextResponse.json({ erro: "nome e e-mail são obrigatórios" }, { status: 400 });

  const existente = await prisma.cliente.findUnique({ where: { email } });
  if (existente)
    return NextResponse.json({ erro: "já existe cliente com esse e-mail" }, { status: 409 });

  const idadeNum = body.idade != null && `${body.idade}`.trim() !== "" ? Number(body.idade) : null;
  const senha = body.senha?.trim();

  const token = crypto.randomBytes(24).toString("base64url");
  const cliente = await prisma.cliente.create({
    data: {
      nome,
      email,
      telefone: body.telefone?.trim() || null,
      idade: Number.isFinite(idadeNum) ? (idadeNum as number) : null,
      cidade: body.cidade?.trim() || null,
      ocupacao: body.ocupacao?.trim() || null,
      rendaMensal: body.rendaMensal?.trim() || null,
      senhaHash: senha ? await bcrypt.hash(senha, 10) : null,
      token,
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    ok: true,
    clienteId: cliente.id,
    link: `${base}/c/${token}`,
    painel: `${base}/paciente/${token}`,
  });
}
