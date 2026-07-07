"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Linha {
  id: string;
  nome: string;
  email: string;
  status: string;
  lgpd: boolean;
  indice: number | null;
  flags: string[];
  ultimoContato: string;
  diasSemContato: number | null;
  link: string;
}

const corStatus: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800",
  pausado: "bg-amber-100 text-amber-800",
  perdido: "bg-gray-200 text-gray-600",
};

export default function ClientesUI({ linhas }: { linhas: Linha[] }) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [linkNovo, setLinkNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const router = useRouter();

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "erro ao criar");
      } else {
        setLinkNovo(d.link);
        setNome("");
        setEmail("");
        setTelefone("");
        router.refresh();
      }
    } finally {
      setOcupado(false);
    }
  }

  function copiar(link: string, id: string) {
    navigator.clipboard.writeText(link);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Clientes ({linhas.length})</h1>
        <button
          onClick={() => {
            setCriando(!criando);
            setLinkNovo(null);
          }}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          {criando ? "Fechar" : "+ Novo cliente"}
        </button>
      </div>

      {criando && (
        <form onSubmit={criar} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo *"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail *"
              type="email"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Telefone"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {linkNovo && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm">
              <span className="truncate font-mono text-emerald-900">{linkNovo}</span>
              <button
                type="button"
                onClick={() => copiar(linkNovo, "novo")}
                className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-xs text-white"
              >
                {copiado === "novo" ? "Copiado!" : "Copiar link"}
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={ocupado || !nome.trim() || !email.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? "Criando…" : "Criar e gerar link mágico"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Progressão</th>
              <th className="px-4 py-3">Último contato</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{l.nome}</div>
                  <div className="text-xs text-gray-500">{l.email}</div>
                  {l.flags.length > 0 && (
                    <span className="mt-0.5 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      ⚠ {l.flags.join(" · ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus[l.status] ?? "bg-gray-100"}`}
                  >
                    {l.status}
                  </span>
                  {!l.lgpd && (
                    <div className="mt-1 text-[10px] text-gray-400">sem consentimento</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.indice === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span
                      className={`font-semibold ${
                        l.indice >= 7
                          ? "text-emerald-700"
                          : l.indice >= 4
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {l.indice.toFixed(1)}
                      {l.indice < 4 && (
                        <span className="ml-1 text-[10px] font-normal">
                          risco de abandono — acionar recaptação
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {l.ultimoContato}
                  {l.diasSemContato !== null && l.diasSemContato >= 7 && (
                    <div className="text-[10px] font-semibold text-red-600">
                      {l.diasSemContato} dias em silêncio
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => copiar(l.link, l.id)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-emerald-600 hover:text-emerald-700"
                  >
                    {copiado === l.id ? "Copiado!" : "Copiar link"}
                  </button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhum cliente ainda — crie o primeiro. 🌱
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
