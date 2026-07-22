import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoPacienteValida } from "@/lib/auth-paciente";
import { lerMemoria } from "@/lib/caso";
import LoginPaciente from "./login";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function PaginaPaciente({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { token } });
  if (!cliente) notFound();

  // gate por senha (se definida); sem senha, o link mágico já autoriza
  if (cliente.senhaHash && !(await sessaoPacienteValida(cliente.id))) {
    return <LoginPaciente token={token} nome={cliente.nome} />;
  }

  const caso = await prisma.caso.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });

  const memoria = caso ? lerMemoria(caso.memoria) : {};
  const anamnese = (memoria.anamnese ?? {}) as Record<string, unknown>;

  const checkins = caso
    ? await prisma.checkin.findMany({ where: { casoId: caso.id }, orderBy: { data: "asc" } })
    : [];
  const fotos = caso
    ? await prisma.foto.findMany({
        where: { casoId: caso.id },
        orderBy: { criadoEm: "desc" },
      })
    : [];
  const dietaLiberada = caso
    ? await prisma.dieta.findFirst({
        where: { casoId: caso.id, status: "liberado" },
        orderBy: { liberadoEm: "desc" },
      })
    : null;
  const dietaPendente = caso
    ? (await prisma.dieta.count({
        where: { casoId: caso.id, status: { in: ["pendente_revisao", "devolvido"] } },
      })) > 0
    : false;

  return (
    <Dashboard
      token={token}
      cliente={{
        nome: cliente.nome,
        cidade: cliente.cidade,
        objetivo: (anamnese.objetivo as string) ?? null,
      }}
      temAnamnese={!!memoria.anamnese}
      baseline={{
        pesoKg: memoria.pesoBaselineKg ?? null,
        medidas: memoria.medidasBaseline ?? {},
      }}
      planoStatus={dietaLiberada ? "liberado" : dietaPendente ? "revisao" : "nenhum"}
      dietaLiberadaId={dietaLiberada?.id ?? null}
      cicloLiberado={dietaLiberada?.ciclo ?? null}
      dietaConteudo={dietaLiberada?.conteudo ?? null}
      checkins={checkins.map((c) => ({
        id: c.id,
        data: c.data.toISOString(),
        peso: c.peso,
        medidas: c.medidas,
        origem: c.origem,
        observacao: c.observacao,
      }))}
      fotos={fotos.map((f) => ({
        id: f.id,
        dados: f.dados,
        angulo: f.angulo,
        criadoEm: f.criadoEm.toISOString(),
      }))}
    />
  );
}
