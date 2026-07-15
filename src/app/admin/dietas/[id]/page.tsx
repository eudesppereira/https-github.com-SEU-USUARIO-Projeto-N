import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { lerMemoria } from "@/lib/caso";
import NavAdmin from "../../nav";
import RevisaoDieta from "./revisao";

export const dynamic = "force-dynamic";

export default async function DetalheDieta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await sessaoAdminValida())) redirect("/admin/login");
  const { id } = await params;

  const dieta = await prisma.dieta.findUnique({
    where: { id },
    include: { caso: { include: { cliente: true } } },
  });
  if (!dieta) notFound();

  const memoria = lerMemoria(dieta.caso.memoria);
  const anamnese = (memoria.anamnese ?? {}) as Record<string, unknown>;
  const perfil = memoria.perfilMetabolico;
  const cli = dieta.caso.cliente;

  const fotos = await prisma.foto.findMany({
    where: { casoId: dieta.casoId },
    orderBy: { criadoEm: "desc" },
    take: 12,
  });

  const resumoAnamnese: [string, string][] = [
    ["Idade", String(anamnese.idade ?? "—")],
    ["Sexo", String(anamnese.sexo ?? "—")],
    ["Peso", anamnese.pesoKg ? `${anamnese.pesoKg} kg` : "—"],
    ["Altura", anamnese.alturaCm ? `${anamnese.alturaCm} cm` : "—"],
    ["IMC", perfil ? `${perfil.imc} (${perfil.classificacaoImc})` : "—"],
    ["Objetivo", String(anamnese.objetivo ?? "—")],
    ["Fator atividade", String(anamnese.fatorAtividade ?? "—")],
    ["TMB", perfil ? `${perfil.tmb} kcal` : "—"],
    ["GET", perfil ? `${perfil.get} kcal` : "—"],
    ["Meta", perfil ? `${perfil.metaCalorica} kcal` : "—"],
    [
      "Macros",
      perfil
        ? `P ${perfil.macros.proteinaG}g · C ${perfil.macros.carboidratoG}g · G ${perfil.macros.gorduraG}g`
        : "—",
    ],
    ["Água", perfil ? `${perfil.aguaLitros} L` : "—"],
    ...(perfil?.mmeKg
      ? ([["MME", `${perfil.mmeKg} kg (%G est. ${(perfil.percentualGorduraEstimado ?? 0) * 100}%)`]] as [string, string][])
      : []),
    ["Índice de progressão", memoria.indiceProgressao != null ? String(memoria.indiceProgressao) : "—"],
  ];

  return (
    <div className="min-h-dvh bg-gray-100">
      <NavAdmin />
      <RevisaoDieta
        dieta={{
          id: dieta.id,
          ciclo: dieta.ciclo,
          conteudo: dieta.conteudo,
          resumoTecnico: dieta.resumoTecnico,
          status: dieta.status,
          notas: dieta.notasDoNutricionista ?? "",
          erroValidacao: dieta.erroValidacao,
          liberadoEm: dieta.liberadoEm?.toLocaleString("pt-BR") ?? null,
        }}
        clienteNome={cli.nome}
        cadastro={{
          idade: cli.idade,
          cidade: cli.cidade,
          ocupacao: cli.ocupacao,
          rendaMensal: cli.rendaMensal,
          email: cli.email,
          telefone: cli.telefone,
        }}
        flags={memoria.flags ?? []}
        resumoAnamnese={resumoAnamnese}
        fotos={fotos.map((f) => ({ id: f.id, dados: f.dados, angulo: f.angulo }))}
      />
    </div>
  );
}
