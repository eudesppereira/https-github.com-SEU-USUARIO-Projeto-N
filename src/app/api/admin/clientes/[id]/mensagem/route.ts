import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { auditar } from "@/lib/audit";
import { lerMemoria } from "@/lib/caso";

const PREFIXO = "👩‍⚕️ *Orientação do nutricionista Eudes Pereira (CRN 52959):* ";

// O nutricionista envia uma orientação diretamente ao chat do paciente
// (ex.: confirmação/ajuste de uma substituição sinalizada pela IA).
// Opcional: `alertaEm` marca o alerta correspondente como resolvido.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await sessaoAdminValida()))
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente)
    return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    texto?: string;
    alertaEm?: string;
  };
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ erro: "mensagem vazia" }, { status: 400 });
  if (texto.length > 4000)
    return NextResponse.json({ erro: "mensagem longa demais" }, { status: 400 });

  const salva = await prisma.mensagem.create({
    data: { clienteId: cliente.id, role: "assistant", conteudo: `${PREFIXO}${texto}` },
  });

  // marca o alerta como resolvido, se informado
  if (body.alertaEm) {
    const caso = await prisma.caso.findFirst({
      where: { clienteId: cliente.id },
      orderBy: { criadoEm: "desc" },
    });
    if (caso) {
      const memoria = lerMemoria(caso.memoria);
      const alertas = (memoria.alertasSubstituicao ?? []).map((a) =>
        a.em === body.alertaEm ? { ...a, resolvido: true } : a
      );
      await prisma.caso.update({
        where: { id: caso.id },
        data: { memoria: JSON.stringify({ ...memoria, alertasSubstituicao: alertas }) },
      });
    }
  }

  await auditar("orientacao_nutricionista", {
    clienteId: cliente.id,
    alertaEm: body.alertaEm ?? null,
    em: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, mensagemId: salva.id });
}
