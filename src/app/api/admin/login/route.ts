import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { criarTokenSessao, NOME_COOKIE_ADMIN } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };
  if (!senha) return NextResponse.json({ erro: "informe a senha" }, { status: 400 });

  const admin = await prisma.admin.findFirst();
  if (!admin || !(await bcrypt.compare(senha, admin.senhaHash))) {
    return NextResponse.json({ erro: "senha incorreta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOME_COOKIE_ADMIN, criarTokenSessao(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
