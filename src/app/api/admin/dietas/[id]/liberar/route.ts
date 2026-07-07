import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { auditar } from "@/lib/audit";
import { encontrarTermosProibidos } from "@/lib/validador";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    conteudo?: string;
    notas?: string;
  };

  const dieta = await prisma.dieta.findUnique({
    where: { id },
    include: { caso: { include: { cliente: true } } },
  });
  if (!dieta) return NextResponse.json({ erro: "dieta não encontrada" }, { status: 404 });
  if (dieta.status !== "pendente_revisao")
    return NextResponse.json(
      { erro: `dieta com status "${dieta.status}" não pode ser liberada` },
      { status: 409 }
    );

  const conteudoFinal = (body.conteudo ?? dieta.conteudo).trim();
  if (!conteudoFinal)
    return NextResponse.json({ erro: "conteúdo vazio" }, { status: 400 });

  // mesmo com edição manual, vocabulário sensacionalista não passa
  const termos = encontrarTermosProibidos(conteudoFinal);
  if (termos.length > 0)
    return NextResponse.json(
      { erro: `O texto contém termos vedados pelo Código de Ética: ${termos.join(", ")}. Reformule antes de liberar.` },
      { status: 422 }
    );

  const liberada = await prisma.dieta.update({
    where: { id },
    data: {
      conteudo: conteudoFinal,
      notasDoNutricionista: body.notas?.trim() || null,
      status: "liberado",
      liberadoEm: new Date(),
    },
  });

  await auditar("liberacao", {
    dietaId: id,
    casoId: dieta.casoId,
    clienteId: dieta.caso.clienteId,
    ciclo: dieta.ciclo,
    editouConteudo: conteudoFinal !== dieta.conteudo.trim(),
  });

  // entrega no chat — única via pela qual o plano chega ao cliente
  const nome = dieta.caso.cliente.nome.split(" ")[0];
  const abertura =
    dieta.ciclo === 1
      ? `Boa notícia, ${nome}! 🎉 Seu plano foi revisado e liberado pelo nutricionista Eudes Pereira (CRN 52959). Aqui está:`
      : `${nome}, sua nova dieta do ciclo ${dieta.ciclo} foi revisada e liberada pelo nutricionista Eudes Pereira (CRN 52959)! Cada mês é uma construção — segue o plano atualizado:`;

  await prisma.mensagem.create({
    data: {
      clienteId: dieta.caso.clienteId,
      role: "assistant",
      conteudo: `${abertura}\n\n${conteudoFinal}\n\nQualquer dúvida sobre o plano, é só perguntar por aqui! 💚`,
    },
  });

  return NextResponse.json({ ok: true, dietaId: liberada.id });
}
