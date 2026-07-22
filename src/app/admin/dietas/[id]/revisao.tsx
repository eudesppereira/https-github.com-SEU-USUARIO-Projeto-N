"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { parsearDieta } from "@/lib/dieta-parse";

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
  cadastro: {
    idade: number | null;
    cidade: string | null;
    ocupacao: string | null;
    rendaMensal: string | null;
    email: string;
    telefone: string | null;
  };
  flags: string[];
  resumoAnamnese: [string, string][];
  fotos: { id: string; dados: string; angulo: string | null }[];
}

export default function RevisaoDieta({ dieta, clienteNome, cadastro, flags, resumoAnamnese, fotos }: Props) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState(dieta.conteudo);
  const [notas, setNotas] = useState(dieta.notas);
  const [instrucoes, setInstrucoes] = useState("");
  const [devolvendo, setDevolvendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const router = useRouter();
  const pendente = dieta.status === "pendente_revisao";
  const dietaLegivel = parsearDieta(conteudo);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-ink)]">
            {clienteNome} — ciclo {dieta.ciclo}
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Status: {dieta.status}
            {dieta.liberadoEm ? ` · liberado em ${dieta.liberadoEm}` : ""}
          </p>
        </div>
        {dieta.status === "liberado" && (
          <a
            href={`/api/admin/dietas/${dieta.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[var(--color-tech-cyan)] px-3 py-1.5 text-xs font-semibold text-[var(--color-tech-cyan-strong)] transition hover:bg-[var(--color-tech-cyan-soft)]"
          >
            Ver PDF
          </a>
        )}
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

      <Surface className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          Cadastro do paciente
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {(
            [
              ["Idade", cadastro.idade != null ? `${cadastro.idade}` : "—"],
              ["Cidade", cadastro.cidade ?? "—"],
              ["Ocupação", cadastro.ocupacao ?? "—"],
              ["Renda mensal", cadastro.rendaMensal ?? "—"],
              ["E-mail", cadastro.email],
              ["Telefone", cadastro.telefone ?? "—"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--color-ink-soft)]">{k}</dt>
              <dd className="font-medium text-[var(--color-ink)] break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      <Surface className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          Anamnese e cálculos
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {resumoAnamnese.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--color-ink-soft)]">{k}</dt>
              <dd className="font-medium text-[var(--color-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      {fotos.length > 0 && (
        <Surface className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Fotos do paciente ({fotos.length})
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.id}
                src={f.dados}
                alt={f.angulo ?? "foto"}
                onClick={() => setZoom(f.dados)}
                className="aspect-square w-full cursor-pointer rounded-xl object-cover shadow-[var(--shadow-soft)] transition hover:scale-[1.02]"
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
            Confidenciais — uso exclusivo para avaliação. Não compartilhar.
          </p>
        </Surface>
      )}

      <Surface className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          Resumo técnico
        </h2>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-ink)]">
          {dieta.resumoTecnico}
        </pre>
      </Surface>

      <Surface className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Dieta proposta
          </h2>
          {pendente && (
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className="rounded-full border border-[var(--color-line-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-strong)] transition hover:bg-[var(--color-brand-soft)]"
            >
              {editando ? "Ver formatado" : "Editar texto"}
            </button>
          )}
        </div>

        {editando ? (
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={24}
            className="w-full rounded-xl border border-[var(--color-line-strong)] p-3 font-mono text-sm outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
          />
        ) : (
          <DietaLegivel dieta={dietaLegivel} />
        )}
        <label className="mt-3 block text-sm text-[var(--color-ink-soft)]">
          Notas do nutricionista (internas)
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={!pendente}
            rows={2}
            className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] p-2 text-sm outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)] disabled:bg-[var(--color-brand-soft)]"
          />
        </label>
      </Surface>

      {erro && (
        <p className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700">{erro}</p>
      )}

      {pendente && !devolvendo && (
        <div className="flex gap-3">
          <Button
            onClick={() => agir("liberar")}
            disabled={ocupado || !conteudo.trim()}
            className="flex-1 py-3"
          >
            {ocupado ? "Processando…" : "Liberar para o cliente"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDevolvendo(true)}
            disabled={ocupado}
            className="flex-1 rounded-xl py-3"
          >
            Devolver com ajustes
          </Button>
        </div>
      )}

      {pendente && devolvendo && (
        <Surface className="space-y-3 border-2 border-[var(--color-line-strong)] p-4">
          <label className="block text-sm font-medium text-[var(--color-ink)]">
            Instruções de ajuste (a IA regera a dieta com base nelas e o caso volta à fila)
            <textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex.: trocar arroz por macarrão no almoço; reduzir carboidrato no jantar"
              className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] p-2 text-sm outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
            />
          </label>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => agir("devolver")}
              disabled={ocupado || !instrucoes.trim()}
              className="rounded-full border-[var(--color-tech-navy)] bg-[var(--color-tech-navy)] text-white"
            >
              {ocupado ? "Regenerando…" : "Devolver e regenerar"}
            </Button>
            <Button variant="ghost" onClick={() => setDevolvendo(false)} disabled={ocupado}>
              Cancelar
            </Button>
          </div>
        </Surface>
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-tech-navy-strong)]/85 p-4 "
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Foto ampliada" className="max-h-full max-w-full rounded-xl shadow-[var(--shadow-lifted)]" />
        </div>
      )}
    </main>
  );
}

// dieta em cards legíveis (macros + refeições em tabela) — em vez do paredão
// monoespaçado. O botão "Editar texto" volta pra textarea bruta.
function DietaLegivel({ dieta }: { dieta: ReturnType<typeof parsearDieta> }) {
  if (dieta.perfil.length === 0 && dieta.refeicoes.length === 0) {
    return (
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--color-brand-soft)] p-3 text-sm text-[var(--color-ink)]">
        {dieta.bruto}
      </pre>
    );
  }
  return (
    <div className="space-y-4">
      {dieta.perfil.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dieta.perfil.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[var(--color-line)] p-2.5">
              <div className="text-[11px] text-[var(--color-ink-soft)]">{k}</div>
              <div className="text-sm font-semibold tabular-nums text-[var(--color-ink)]">{v}</div>
            </div>
          ))}
        </div>
      )}
      {dieta.refeicoes.map((r) => (
        <div key={r.titulo} className="overflow-hidden rounded-xl border border-[var(--color-line)]">
          <div className="bg-[var(--color-brand-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand-strong)]">
            {r.titulo}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-3 py-1 font-medium">Alimento</th>
                <th className="px-2 py-1 font-medium">Medida caseira</th>
                <th className="px-3 py-1 text-right font-medium">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {r.itens.map((item, i) => (
                <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-3 py-1.5 text-[var(--color-ink)]">{item.alimento}</td>
                  <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{item.medidaCaseira ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-ink)]">{item.gramas ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.subtotal && (
            <p className="border-t border-[var(--color-line)] px-3 py-1 text-right text-xs text-[var(--color-ink-soft)]">
              Subtotal: {r.subtotal}
            </p>
          )}
        </div>
      ))}
      {dieta.orientacoes && (
        <p className="text-sm leading-relaxed text-[var(--color-ink)]">
          <b>Orientações:</b> {dieta.orientacoes}
        </p>
      )}
      {dieta.observacoesClinicas && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Observações clínicas:</b> {dieta.observacoesClinicas}
        </div>
      )}
    </div>
  );
}
