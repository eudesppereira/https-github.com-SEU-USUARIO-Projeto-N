import { NextResponse } from "next/server";
import { NOME_COOKIE_ADMIN } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOME_COOKIE_ADMIN, "", { path: "/", maxAge: 0 });
  return res;
}
