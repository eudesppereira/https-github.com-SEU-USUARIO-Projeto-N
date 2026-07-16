import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { criarTokenPaciente, nomeCookiePaciente } from "@/lib/auth-paciente";

// Login público por e-mail+senha (landing de planos) — assinante já cadastrado
// entra sem precisar do link mágico. Mesma sessão usada em /paciente/[token].
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; senha?: string };
  const email = body.email?.trim().toLowerCase();
  const senha = body.senha?.trim();
  if (!email || !senha)
    return NextResponse.json({ erro: "e-mail e senha são obrigatórios" }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({ where: { email } });
  if (!cliente || !cliente.senhaHash || !(await bcrypt.compare(senha, cliente.senhaHash)))
    return NextResponse.json({ erro: "e-mail ou senha incorretos" }, { status: 401 });

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
