import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoAdminValida } from "@/lib/auth";
import { lerMemoria } from "@/lib/caso";
import NavAdmin from "../nav";
import ClientesUI from "./clientes-ui";

export const dynamic = "force-dynamic";

export default async function PaginaClientes() {
  if (!(await sessaoAdminValida())) redirect("/admin/login");

  const clientes = await prisma.cliente.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      casos: { orderBy: { criadoEm: "desc" }, take: 1 },
      mensagens: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";

  const linhas = clientes.map((c) => {
    const memoria = c.casos[0] ? lerMemoria(c.casos[0].memoria) : {};
    const ultimaMsg = c.mensagens[0]?.timestamp ?? null;
    const diasSemContato = ultimaMsg
      ? Math.floor((Date.now() - ultimaMsg.getTime()) / 86400000)
      : null;
    return {
      id: c.id,
      nome: c.nome,
      email: c.email,
      status: c.status,
      lgpd: c.consentimentoLgpd,
      indice: memoria.indiceProgressao ?? null,
      flags: memoria.flags ?? [],
      ultimoContato: ultimaMsg ? ultimaMsg.toLocaleString("pt-BR") : "nunca",
      diasSemContato,
      link: `${base}/c/${c.token}`,
    };
  });

  return (
    <div className="min-h-dvh bg-gray-100">
      <NavAdmin />
      <ClientesUI linhas={linhas} />
    </div>
  );
}
