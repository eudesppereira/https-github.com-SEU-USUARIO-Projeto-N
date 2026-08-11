"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AlertaAdmin {
  clienteId: string;
  clienteNome: string;
  chatUrl: string;
  refeicao: string;
  alimentoOriginal: string;
  sugerido: string;
  motivo: string;
  nivel: string;
  confianca: string;
  em: string;
}

// Painel do nutricionista: substituições que a IA provisionou mas sinalizou por
// não ter plena certeza. O nutri fica ciente e, se quiser, manda uma orientação
// direto ao chat do paciente (que marca o alerta como resolvido).
export default function AlertasSubstituicao({ alertas }: { alertas: AlertaAdmin[] }) {
  if (alertas.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
        <span className="inline-flex h-5 items-center rounded-full bg-amber-500 px-2 text-[11px] font-bold text-white">
          {alertas.length}
        </span>
        Alertas de substituição
      </h2>
      <div className="space-y-3">
        {alertas.map((a) => (
          <AlertaCard key={`${a.clienteId}-${a.em}`} alerta={a} />
        ))}
      </div>
    </section>
  );
}

function AlertaCard({ alerta: a }: { alerta: AlertaAdmin }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/clientes/${a.clienteId}/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t, alertaEm: a.em }),
      });
      if (!r.ok) {
        setErro((await r.json().catch(() => ({}))).erro ?? "erro ao enviar");
      } else {
        setOk(true);
        setTimeout(() => router.refresh(), 900);
      }
    } catch {
      setErro("sem conexão");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-ink)]">{a.clienteNome}</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-900">
            nível {a.nivel || "?"}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[var(--color-ink-soft)]">
            confiança {a.confianca || "?"}
          </span>
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--color-ink)]">
        <span className="text-[var(--color-ink-soft)]">{a.refeicao}:</span>{" "}
        <strong>{a.alimentoOriginal}</strong> → <strong>{a.sugerido}</strong>
      </p>
      {a.motivo && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{a.motivo}</p>}

      {ok ? (
        <p className="mt-3 text-sm font-medium text-[var(--color-brand)]">Orientação enviada ao paciente ✓</p>
      ) : !aberto ? (
        <div className="mt-3 flex gap-2">
          <a
            href={a.chatUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)] hover:border-[var(--color-tech-cyan)]"
          >
            Ver conversa
          </a>
          <button
            onClick={() => setAberto(true)}
            className="rounded-full bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-strong)]"
          >
            Orientar paciente
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Mensagem que o paciente vai receber no chat (ex.: confirmo a troca; pode seguir com a maçã)…"
            className="w-full resize-none rounded-xl border border-[var(--color-line-strong)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
          />
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {enviando ? "Enviando…" : "Enviar ao paciente"}
            </button>
            <button
              onClick={() => setAberto(false)}
              className="rounded-full px-3 py-1.5 text-xs text-[var(--color-ink-soft)] hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
