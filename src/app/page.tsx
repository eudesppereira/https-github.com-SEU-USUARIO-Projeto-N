import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";

const LEDGER = [
  { data: "14 mai", peso: "82,4 kg", delta: null },
  { data: "21 mai", peso: "81,1 kg", delta: "-1,3" },
  { data: "28 mai", peso: "80,0 kg", delta: "-1,1" },
  { data: "04 jun", peso: "79,2 kg", delta: "-0,8" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--color-ink)]">
      {/* hero: verde floresta cobrindo toda a dobra — a cor carrega a marca aqui,
          não é só um acento em botão */}
      <section className="bg-[var(--color-brand-strong)]">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white font-display text-base font-extrabold text-[var(--color-brand-strong)]">
              N
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              Nutre.AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/planos"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-brand-strong)] transition hover:bg-white/90"
            >
              Ver planos
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-white/25 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-white/50 hover:text-white"
            >
              Área do profissional
            </Link>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-10">
          <div className="reveal">
            <h1 className="font-display text-[2.75rem] font-extrabold leading-[1.03] tracking-[-0.02em] text-white text-balance sm:text-6xl">
              Cada grama registrado.
              <br />
              <span style={{ color: "oklch(72% 0.14 155)" }}>Cada ajuste revisado</span> por
              gente de verdade.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: "oklch(88% 0.02 155)" }}>
              Nutre.AI acompanha seu peso, medidas e evolução todos os dias — e nenhum plano
              sai do forno sem passar pelo nutricionista{" "}
              <strong className="font-semibold text-white">Eudes Pereira, CRN 52959</strong>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/planos"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--color-brand-strong)] transition hover:bg-white/90"
              >
                Ver planos e assinar
              </Link>
              <p className="text-sm" style={{ color: "oklch(78% 0.02 155)" }}>
                Já é cliente? Acesse pelo link exclusivo que você recebeu no WhatsApp.
              </p>
            </div>
          </div>

          {/* assinatura visual: ficha de medição real, não um card-dashboard genérico */}
          <div className="mx-auto w-full max-w-sm rounded-xl bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] lg:mx-0 lg:justify-self-end">
            <div
              className="reveal flex items-baseline justify-between border-b border-[var(--color-line)] px-5 py-4"
              style={{ transitionDelay: "0.1s" }}
            >
              <div>
                <p className="text-[11px] text-[var(--color-ink-soft)]">Ficha de acompanhamento</p>
                <p className="text-sm font-semibold text-[var(--color-ink)]">Check-in de Ana</p>
              </div>
              <span className="text-[11px] text-[var(--color-ink-soft)]">6 semanas</span>
            </div>
            <div className="px-5 py-2">
              {LEDGER.map((l, i) => (
                <div
                  key={l.data}
                  className="reveal flex items-center justify-between border-b border-[var(--color-line)] py-2.5 text-sm last:border-0"
                  style={{ transitionDelay: `${0.24 + i * 0.14}s` }}
                >
                  <span className="text-[var(--color-ink-soft)]">{l.data}</span>
                  <span className="font-medium tabular-nums text-[var(--color-ink)]">{l.peso}</span>
                  <span
                    className="w-12 text-right text-xs font-semibold tabular-nums"
                    style={{ color: l.delta ? "var(--color-accent-strong)" : "transparent" }}
                  >
                    {l.delta ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <p
              className="reveal border-t border-[var(--color-line)] px-5 py-3 text-xs leading-relaxed text-[var(--color-ink-soft)]"
              style={{ transitionDelay: "0.8s" }}
            >
              “Registrei meu peso e o Eudes ajustou o plano na mesma semana.”
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* como funciona, contado com o próprio mecanismo do produto: o chat */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <p className="reveal max-w-md text-[var(--color-ink-soft)]">
            Como isso acontece, na prática — a mesma conversa que você já teria no WhatsApp:
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:gap-4">
            <div className="reveal" style={{ transitionDelay: "0s" }}>
              <p className="mb-2 text-sm font-semibold text-[var(--color-ink)]">
                Você conta o que precisa
              </p>
              <div className="space-y-1.5">
                <Bubble align="right">Comecei hoje: 82kg, quero emagrecer com saúde.</Bubble>
                <Bubble align="left">
                  Entendi! Só mais duas perguntas sobre sua rotina e já monto sua avaliação.
                </Bubble>
              </div>
            </div>

            <div className="reveal" style={{ transitionDelay: "0.12s" }}>
              <p className="mb-2 text-sm font-semibold text-[var(--color-ink)]">
                Eudes revisa antes de liberar
              </p>
              <div className="space-y-1.5">
                <Bubble align="left">
                  Seu plano ficou pronto: 1.850kcal, foco em proteína no café.
                </Bubble>
                <div className="flex items-center gap-1.5 pl-1 text-xs font-medium text-[var(--color-brand)]">
                  <CheckMark /> revisado por Eudes Pereira · CRN 52959
                </div>
              </div>
            </div>

            <div className="reveal" style={{ transitionDelay: "0.24s" }}>
              <p className="mb-2 text-sm font-semibold text-[var(--color-ink)]">
                Você registra, a ficha atualiza
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
                {[
                  { data: "12 jun", peso: "78,4 kg" },
                  { data: "19 jun", peso: "77,6 kg" },
                ].map((l) => (
                  <div
                    key={l.data}
                    className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2 text-sm last:border-0"
                  >
                    <span className="text-[var(--color-ink-soft)]">{l.data}</span>
                    <span className="font-medium tabular-nums text-[var(--color-ink)]">{l.peso}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* credibilidade — faixa discreta, sem caixa colorida */}
        <section className="border-y border-[var(--color-line)] bg-[var(--color-brand-soft)]">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand)] font-display text-sm font-bold text-white">
                EP
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">Eudes Pereira</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Nutricionista responsável · CRN 52959</p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[var(--color-ink-soft)]">
              A IA organiza dados e faz perguntas. Quem decide o que entra no seu plano é sempre
              o profissional.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-xs text-[var(--color-ink-soft)]">
        © {new Date().getFullYear()} Nutre.AI
      </footer>
      <ScrollReveal />
    </div>
  );
}

function Bubble({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug ${
          align === "right"
            ? "rounded-br-none bg-[var(--color-brand-soft)] text-[var(--color-ink)]"
            : "rounded-bl-none border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
      <path d="M7.6 13.2 4.4 10l-1.4 1.4 4.6 4.6 8-8L14.2 6.6z" />
    </svg>
  );
}
