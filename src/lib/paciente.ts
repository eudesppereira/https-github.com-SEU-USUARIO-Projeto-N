// Helpers compartilhados pelas rotas do paciente.
// Escrita (medição/foto) é autorizada pela posse do token do link (a mesma
// credencial do chat); a LEITURA do painel completo fica atrás da senha (page.tsx).
import { prisma } from "./db";

export async function casoAtualDoCliente(clienteId: string) {
  return prisma.caso.findFirst({
    where: { clienteId },
    orderBy: { criadoEm: "desc" },
  });
}
