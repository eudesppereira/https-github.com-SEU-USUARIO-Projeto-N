import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { criarTokenPaciente, nomeCookiePaciente } from "@/lib/auth-paciente";

const PLANOS_VALIDOS = ["essencial", "performance", "premium"];

// Cadastro público (landing de planos) — cliente escolhe um plano, cria conta
// com e-mail+senha e já sai logado (mesma sessão usada em /paciente/[token]).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    nome?: string;
    email?: string;
    senha?: string;
    plano?: string;
  };

  const nome = body.nome?.trim();
  const email = body.email?.trim().toLowerCase();
  const senha = body.senha?.trim();
  const plano = body.plano?.trim().toLowerCase();

  if (!nome || !email || !senha)
    return NextResponse.json({ erro: "nome, e-mail e senha são obrigatórios" }, { status: 400 });
  if (senha.length < 6)
    return NextResponse.json({ erro: "senha precisa ter pelo menos 6 caracteres" }, { status: 400 });
  if (!plano || !PLANOS_VALIDOS.includes(plano))
    return NextResponse.json({ erro: "selecione um plano válido" }, { status: 400 });

  const existente = await prisma.cliente.findUnique({ where: { email } });
  if (existente)
    return NextResponse.json({ erro: "já existe uma conta com esse e-mail" }, { status: 409 });

  const token = crypto.randomBytes(24).toString("base64url");
  const cliente = await prisma.cliente.create({
    data: {
      nome,
      email,
      plano,
      senhaHash: await bcrypt.hash(senha, 10),
      token,
    },
  });

  const res = NextResponse.json({ ok: true, token: cliente.token });
  res.cookies.set(nomeCookiePaciente(cliente.id), criarTokenPaciente(cliente.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
