import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { lerMemoria } from "@/lib/caso";
import NavAdmin from "./nav";
import AlertasSubstituicao, { type AlertaAdmin } from "./AlertasSubstituicao";

export const dynamic = "force-dynamic";

const rotuloStatus: Record<string, string> = {
  pendente_revisao: "Pendente de revisão",
  liberado: "Liberado",
  devolvido: "Devolvido",
  rascunho: "Rascunho",
};

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

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

  // Alertas de substituição (IA provisionou uma troca e pediu ciência do nutri).
  const casos = await prisma.caso.findMany({ include: { cliente: true } });
  const alertas: AlertaAdmin[] = [];
  for (const c of casos) {
    const memoria = lerMemoria(c.memoria);
    for (const a of memoria.alertasSubstituicao ?? []) {
      if (a.resolvido) continue;
      alertas.push({
        clienteId: c.cliente.id,
        clienteNome: c.cliente.nome,
        chatUrl: `/c/${c.cliente.token}`,
        refeicao: a.refeicao,
        alimentoOriginal: a.alimentoOriginal,
        sugerido: a.sugerido,
        motivo: a.motivo,
        nivel: a.nivel,
        confianca: a.confianca,
        em: a.em,
      });
    }
  }
  alertas.sort((a, b) => b.em.localeCompare(a.em));

  function Card({ dieta }: { dieta: (typeof pendentes)[number] }) {
    const memoria = lerMemoria(dieta.caso.memoria);
    const flags = memoria.flags ?? [];
    return (
      <Link
        href={`/admin/dietas/${dieta.id}`}
        className="block rounded-xl border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-tech-cyan)] hover:shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] font-display text-xs font-bold text-[var(--color-brand-strong)]">
              {iniciais(dieta.caso.cliente.nome)}
            </span>
            <div>
              <span className="font-semibold text-[var(--color-ink)]">
                {dieta.caso.cliente.nome}
              </span>
              <span className="ml-2 text-sm text-[var(--color-ink-soft)]">ciclo {dieta.ciclo}</span>
            </div>
          </div>
          <span className="text-xs text-[var(--color-ink-soft)]">
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
    <div className="min-h-dvh bg-[var(--background)]">
      <NavAdmin />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <AlertasSubstituicao alertas={alertas} />

        <section>
          <h1 className="mb-3 text-lg font-bold text-[var(--color-ink)]">
            Aguardando revisão ({pendentes.length})
          </h1>
          {pendentes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] p-6 text-center text-sm text-[var(--color-ink-soft)]">
              Nenhum caso na fila.
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
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              Histórico recente
            </h2>
            <div className="space-y-2">
              {recentes.map((d) => (
                <Link
                  key={d.id}
                  href={`/admin/dietas/${d.id}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft)]"
                >
                  <span>
                    {d.caso.cliente.nome} · ciclo {d.ciclo}
                  </span>
                  <span
                    className={
                      d.status === "liberado" ? "text-[var(--color-brand)]" : "text-[var(--color-ink-soft)]"
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
