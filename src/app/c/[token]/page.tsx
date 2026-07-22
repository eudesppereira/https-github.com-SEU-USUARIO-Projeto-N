import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Chat from "./chat";

export const dynamic = "force-dynamic";

export default async function PaginaChat({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) notFound();

  const mensagens = await prisma.mensagem.findMany({
    where: { clienteId: cliente.id },
    orderBy: { timestamp: "asc" },
  });

  // dieta liberada mais recente — usada pra abrir o plano em painel próprio
  // (card "Abrir plano completo") em vez de despejar o texto no chat.
  const caso = await prisma.caso.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });
  const dietaLiberada = caso
    ? await prisma.dieta.findFirst({
        where: { casoId: caso.id, status: "liberado" },
        orderBy: { liberadoEm: "desc" },
      })
    : null;

  return (
    <Chat
      token={token}
      mensagensIniciais={mensagens.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        conteudo: m.conteudo,
      }))}
      dietaLiberadaId={dietaLiberada?.id ?? null}
      cicloLiberado={dietaLiberada?.ciclo ?? null}
    />
  );
}
