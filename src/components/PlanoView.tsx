"use client";

import { useEffect } from "react";
import { parsearDieta } from "@/lib/dieta-parse";

/**
 * Painel dedicado do plano alimentar liberado (fim do "paredão de texto").
 * Recebe o texto bruto da dieta, parseia e mostra: macros, refeições em
 * TABELA (Alimento · Medida caseira · Gramas), substituições, orientações,
 * observações e "Baixar PDF". Usado no chat e no painel do cliente como
 * overlay. Padrão verde.
 */
export function PlanoView({
  texto,
  ciclo,
  pdfHref,
  onClose,
}: {
  texto: string;
  ciclo: number | null;
  pdfHref: string | null;
  onClose: () => void;
}) {
  const d = parsearDieta(texto);

  // fecha no Esc e trava o scroll do body enquanto aberto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-[var(--color-tech-navy-strong)]/60 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex min-h-full w-full max-w-2xl flex-col bg-[var(--background)] shadow-[var(--shadow-lifted)] sm:min-h-0 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabeçalho verde fixo */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl bg-[var(--color-brand-strong)] px-5 py-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-tech-cyan)]">
              Plano alimentar liberado
            </p>
            <p className="font-display text-base font-bold">
              {ciclo ? `Ciclo ${ciclo}` : "Seu plano"} · revisado por Eudes Pereira · CRN 52959
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar plano"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 5.7 18.3 4.3 16.9 10.6 12 4.3 5.7 5.7 4.3l4.9 4.9 6.3-6.3z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          {/* macros / perfil metabólico */}
          {d.perfil.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                Perfil e metas
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {d.perfil.map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="text-[11px] text-[var(--color-ink-soft)]">{k}</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* refeições em tabela */}
          {d.refeicoes.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                Cardápio
              </h3>
              <div className="space-y-4">
                {d.refeicoes.map((r) => (
                  <div
                    key={r.titulo}
                    className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
                  >
                    <div className="bg-[var(--color-brand-soft)] px-4 py-2">
                      <p className="text-sm font-semibold text-[var(--color-brand-strong)]">
                        {r.titulo}
                      </p>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-ink-soft)]">
                          <th className="px-4 py-1.5 font-medium">Alimento</th>
                          <th className="px-2 py-1.5 font-medium">Medida caseira</th>
                          <th className="px-4 py-1.5 text-right font-medium">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.itens.map((item, i) => (
                          <tr
                            key={i}
                            className="border-b border-[var(--color-line)] last:border-0"
                          >
                            <td className="px-4 py-2 text-[var(--color-ink)]">{item.alimento}</td>
                            <td className="px-2 py-2 text-[var(--color-ink-soft)]">
                              {item.medidaCaseira ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-[var(--color-ink)]">
                              {item.gramas ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.subtotal && (
                      <p className="border-t border-[var(--color-line)] px-4 py-1.5 text-right text-xs text-[var(--color-ink-soft)]">
                        Subtotal: {r.subtotal}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* substituições */}
          {d.substituicoes.length > 0 && (
            <Bloco titulo="Substituições">
              <ul className="space-y-1 text-sm leading-relaxed text-[var(--color-ink)]">
                {d.substituicoes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Bloco>
          )}

          {d.orientacoes && (
            <Bloco titulo="Orientações">
              <p className="text-sm leading-relaxed text-[var(--color-ink)]">{d.orientacoes}</p>
            </Bloco>
          )}

          {d.observacoesClinicas && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                Observações clínicas
              </h3>
              <p className="text-sm leading-relaxed text-amber-900">{d.observacoesClinicas}</p>
            </div>
          )}

          {d.acompanhamento && (
            <p className="text-sm text-[var(--color-ink-soft)]">
              <b className="text-[var(--color-ink)]">Acompanhamento:</b> {d.acompanhamento}
            </p>
          )}

          {d.disclaimer && (
            <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{d.disclaimer}</p>
          )}

          {/* fallback: se nada foi parseado, mostra o texto cru */}
          {d.perfil.length === 0 && d.refeicoes.length === 0 && (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">
              {texto}
            </pre>
          )}
        </div>

        {/* rodapé com ações */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 sm:rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:bg-black/5"
          >
            Fechar
          </button>
          {pdfHref && (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-strong)]"
            >
              Baixar PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
