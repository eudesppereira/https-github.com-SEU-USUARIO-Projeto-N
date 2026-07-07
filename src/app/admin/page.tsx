import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { lerMemoria } from "@/lib/caso";
import NavAdmin from "./nav";

export const dynamic = "force-dynamic";

const rotuloStatus: Record<string, string> = {
  pendente_revisao: "Pendente de revisão",
  liberado: "Liberado",
  devolvido: "Devolvido",
  rascunho: "Rascunho",
};

export default async function FilaAdmin() {
  if (!(await sessaoAdminValida())) redirect("/admin/login");

  const pendentes = await prisma.dieta.findMany({
    where: { status: "pendente_revisao" },
    orderBy: { criadoEm: "asc" },
    include: { caso: { include: { cliente: true } } },
  });
  const recentes = await prisma.dieta.findMany({
    where: { status: { in: ["liberado", "devolvido"] } },
    orderBy: { criadoEm: "desc" },
    take: 10,
    include: { caso: { include: { cliente: true } } },
  });

  function Card({ dieta }: { dieta: (typeof pendentes)[number] }) {
    const memoria = lerMemoria(dieta.caso.memoria);
    const flags = memoria.flags ?? [];
    return (
      <Link
        href={`/admin/dietas/${dieta.id}`}
        className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-500"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-900">
              {dieta.caso.cliente.nome}
            </span>
            <span className="ml-2 text-sm text-gray-500">ciclo {dieta.ciclo}</span>
          </div>
          <span className="text-xs text-gray-400">
            {dieta.criadoEm.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {rotuloStatus[dieta.status] ?? dieta.status}
          </span>
          {flags.map((f) => (
            <span
              key={f}
              className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
            >
              ⚠ {f}
            </span>
          ))}
          {dieta.erroValidacao && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              validação falhou — revisão manual
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-100">
      <NavAdmin />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h1 className="mb-3 text-lg font-bold text-gray-900">
            Aguardando revisão ({pendentes.length})
          </h1>
          {pendentes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Nenhum caso na fila. 👌
            </p>
          ) : (
            <div className="space-y-3">
              {pendentes.map((d) => (
                <Card key={d.id} dieta={d} />
              ))}
            </div>
          )}
        </section>

        {recentes.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Histórico recente
            </h2>
            <div className="space-y-2">
              {recentes.map((d) => (
                <Link
                  key={d.id}
                  href={`/admin/dietas/${d.id}`}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm shadow-sm"
                >
                  <span>
                    {d.caso.cliente.nome} · ciclo {d.ciclo}
                  </span>
                  <span
                    className={
                      d.status === "liberado" ? "text-emerald-700" : "text-gray-500"
                    }
                  >
                    {rotuloStatus[d.status]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
