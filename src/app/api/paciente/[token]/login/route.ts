import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { criarTokenPaciente, nomeCookiePaciente } from "@/lib/auth-paciente";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  // Sem senha definida: acesso é por link mágico, login não se aplica
  if (!cliente.senhaHash)
    return NextResponse.json({ ok: true, semSenha: true });

  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };
  if (!senha || !(await bcrypt.compare(senha, cliente.senhaHash)))
    return NextResponse.json({ erro: "senha incorreta" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(nomeCookiePaciente(cliente.id), criarTokenPaciente(cliente.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
