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
  const vazio = {
    nome: "",
    email: "",
    telefone: "",
    idade: "",
    cidade: "",
    ocupacao: "",
    rendaMensal: "",
    senha: "",
  };
  const [form, setForm] = useState(vazio);
  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));
  const [linkNovo, setLinkNovo] = useState<{ link: string; painel: string } | null>(null);
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
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "erro ao criar");
      } else {
        setLinkNovo({ link: d.link, painel: d.painel });
        setForm(vazio);
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

  async function excluirDados(l: Linha) {
    const confirmacao = prompt(
      `EXCLUSÃO DEFINITIVA (LGPD): todos os dados de ${l.nome} — caso, dietas, check-ins e conversas — serão apagados. Digite o e-mail do cliente para confirmar:`
    );
    if (confirmacao?.trim().toLowerCase() !== l.email.toLowerCase()) return;
    const r = await fetch(`/api/admin/clientes/${l.id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert("Erro ao excluir.");
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
        <form onSubmit={criar} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dados do paciente</h2>
            <p className="text-xs text-gray-500">* obrigatórios. Os demais ajudam na avaliação e no encaixe de custo dos alimentos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Nome completo *
              <input value={form.nome} onChange={set("nome")} placeholder="Ex.: Maria Silva"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              E-mail *
              <input value={form.email} onChange={set("email")} type="email" placeholder="maria@email.com"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Telefone
              <input value={form.telefone} onChange={set("telefone")} placeholder="(19) 90000-0000"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Idade
              <input value={form.idade} onChange={set("idade")} type="number" min={0} placeholder="Ex.: 32"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Cidade
              <input value={form.cidade} onChange={set("cidade")} placeholder="Ex.: Piracicaba/SP"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Ocupação (trabalho)
              <input value={form.ocupacao} onChange={set("ocupacao")} placeholder="Ex.: professora"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Renda média mensal
              <input value={form.rendaMensal} onChange={set("rendaMensal")} placeholder="Ex.: R$ 3.000 (encaixe de custo)"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Senha do painel do paciente (opcional)
              <input value={form.senha} onChange={set("senha")} type="text" placeholder="deixe vazio p/ acesso só por link"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600" />
            </label>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {linkNovo && (
            <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-emerald-800">Painel:</span>
                <span className="truncate font-mono text-emerald-900">{linkNovo.painel}</span>
                <button type="button" onClick={() => copiar(linkNovo.painel, "painel")}
                  className="ml-auto shrink-0 rounded bg-emerald-700 px-2 py-1 text-xs text-white">
                  {copiado === "painel" ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-emerald-800">Chat:</span>
                <span className="truncate font-mono text-emerald-900">{linkNovo.link}</span>
                <button type="button" onClick={() => copiar(linkNovo.link, "chat")}
                  className="ml-auto shrink-0 rounded bg-emerald-700 px-2 py-1 text-xs text-white">
                  {copiado === "chat" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={ocupado || !form.nome.trim() || !form.email.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? "Criando…" : "Criar cliente e gerar acesso"}
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
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => copiar(l.link, l.id)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-emerald-600 hover:text-emerald-700"
                    >
                      {copiado === l.id ? "Copiado!" : "Copiar link"}
                    </button>
                    <button
                      onClick={() => excluirDados(l)}
                      title="Excluir todos os dados (LGPD)"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:border-red-500 hover:bg-red-50"
                    >
                      Excluir dados
                    </button>
                  </div>
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
