import { prisma } from "./db";

export type EventoAuditoria =
  | "consentimento_lgpd"
  | "consentimento_fotos"
  | "dieta_gerada"
  | "liberacao"
  | "devolucao"
  | "exclusao_solicitada"
  | "exclusao"
  | "validacao_falhou";

export async function auditar(evento: EventoAuditoria, payload: Record<string, unknown>) {
  await prisma.auditoria.create({
    data: { evento, payload: JSON.stringify(payload) },
  });
}
