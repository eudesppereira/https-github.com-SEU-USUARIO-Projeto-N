import crypto from "crypto";
import { cookies } from "next/headers";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function segredo(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definido no .env");
  return s;
}

function assinar(payload: string): string {
  return crypto.createHmac("sha256", segredo()).update(payload).digest("hex");
}

export function nomeCookiePaciente(clienteId: string): string {
  return `nutre_pac_${clienteId}`;
}

export function criarTokenPaciente(clienteId: string): string {
  const expira = Date.now() + TTL_MS;
  const payload = `${clienteId}.${expira}`;
  return `${payload}.${assinar(payload)}`;
}

export function verificarTokenPaciente(clienteId: string, token: string | undefined): boolean {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [id, expiraStr, mac] = partes;
  if (id !== clienteId) return false;
  const esperado = assinar(`${id}.${expiraStr}`);
  if (mac.length !== esperado.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return false;
  return Number(expiraStr) > Date.now();
}

export async function sessaoPacienteValida(clienteId: string): Promise<boolean> {
  const jar = await cookies();
  return verificarTokenPaciente(clienteId, jar.get(nomeCookiePaciente(clienteId))?.value);
}
