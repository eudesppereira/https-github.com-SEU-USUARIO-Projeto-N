import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "nutre_admin";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function segredo(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definido no .env");
  return s;
}

function assinar(payload: string): string {
  return crypto.createHmac("sha256", segredo()).update(payload).digest("hex");
}

export function criarTokenSessao(): string {
  const expira = Date.now() + TTL_MS;
  const payload = `admin.${expira}`;
  return `${payload}.${assinar(payload)}`;
}

export function verificarTokenSessao(token: string | undefined): boolean {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== "admin") return false;
  const [tipo, expiraStr, mac] = partes;
  const payload = `${tipo}.${expiraStr}`;
  const esperado = assinar(payload);
  if (mac.length !== esperado.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return false;
  return Number(expiraStr) > Date.now();
}

export const NOME_COOKIE_ADMIN = COOKIE;

export async function sessaoAdminValida(): Promise<boolean> {
  const jar = await cookies();
  return verificarTokenSessao(jar.get(COOKIE)?.value);
}
