"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  dieta: {
    id: string;
    ciclo: number;
    conteudo: string;
    resumoTecnico: string;
    status: string;
    notas: string;
    erroValidacao: string | null;
    liberadoEm: string | null;
  };
  clienteNome: string;
  flags: string[];
  resumoAnamnese: [string, string][];
}

export default function RevisaoDieta({ dieta, clienteNome, flags, resumoAnamnese }: Props) {
  const [conteudo, setConteudo] = useState(dieta.conteudo);
  const [notas, setNotas] = useState(dieta.notas);
  const [instrucoes, setInstrucoes] = useState("");
  const [devolvendo, setDevolvendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const pendente = dieta.status === "pendente_revisao";

  async function agir(acao: "liberar" | "devolver") {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/dietas/${dieta.id}/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          acao === "liberar" ? { conteudo, notas } : { instrucoes }
        ),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "erro ao processar");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-lg font-bold text-gray-900">
          {clienteNome} — ciclo {dieta.ciclo}
        </h1>
        <p className="text-sm text-gray-500">
          Status: {dieta.status}
          {dieta.liberadoEm ? ` · liberado em ${dieta.liberadoEm}` : ""}
        </p>
      </div>

      {flags.length > 0 && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4">
          <p className="font-bold text-red-700">⚠ FLAGS DE REVISÃO OBRIGATÓRIA</p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-700">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-600">
            Caso exige análise individualizada antes da liberação.
          </p>
        </div>
      )}

      {dieta.erroValidacao && (
        <div className="rounded-xl border-2 border-orange-400 bg-orange-50 p-4">
          <p className="font-bold text-orange-700">
            Validação automática falhou — revisão manual necessária
          </p>
          <p className="mt-1 text-sm text-orange-700">{dieta.erroValidacao}</p>
        </div>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Anamnese e cálculos
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {resumoAnamnese.map(([k, v]) => (
            <div key={k}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-medium text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Resumo técnico
        </h2>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
          {dieta.resumoTecnico}
        </pre>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dieta proposta {pendente && "(editável)"}
        </h2>
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          disabled={!pendente}
          rows={24}
          className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm outline-none focus:border-emerald-600 disabled:bg-gray-50"
        />
        <label className="mt-3 block text-sm text-gray-600">
          Notas do nutricionista (internas)
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={!pendente}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-600 disabled:bg-gray-50"
          />
        </label>
      </section>

      {erro && (
        <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{erro}</p>
      )}

      {pendente && !devolvendo && (
        <div className="flex gap-3">
          <button
            onClick={() => agir("liberar")}
            disabled={ocupado || !conteudo.trim()}
            className="flex-1 rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {ocupado ? "Processando…" : "✓ Liberar para o cliente"}
          </button>
          <button
            onClick={() => setDevolvendo(true)}
            disabled={ocupado}
            className="flex-1 rounded-xl border-2 border-gray-300 bg-white py-3 font-semibold text-gray-700 hover:border-gray-400"
          >
            Devolver com ajustes
          </button>
        </div>
      )}

      {pendente && devolvendo && (
        <div className="space-y-3 rounded-xl border-2 border-gray-300 bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">
            Instruções de ajuste (a IA regera a dieta com base nelas e o caso volta à fila)
            <textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex.: trocar arroz por macarrão no almoço; reduzir carboidrato no jantar"
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => agir("devolver")}
              disabled={ocupado || !instrucoes.trim()}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ocupado ? "Regenerando…" : "Devolver e regenerar"}
            </button>
            <button
              onClick={() => setDevolvendo(false)}
              disabled={ocupado}
              className="rounded-lg px-4 py-2 text-sm text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
