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

  return (
    <Chat
      token={token}
      mensagensIniciais={mensagens.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        conteudo: m.conteudo,
      }))}
    />
  );
}
