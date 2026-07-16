"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

interface Plano {
  id: "essencial" | "performance" | "premium";
  nome: string;
  preco: string;
  destaque?: boolean;
  resumo: string;
  itens: string[];
}

const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    preco: "89,90",
    resumo: "Pra começar com acompanhamento de verdade.",
    itens: [
      "Avaliação completa via chat com o Nutre.AI",
      "1 plano alimentar liberado pelo nutricionista/mês",
      "Registro de peso e medidas",
      "Suporte por chat em horário comercial",
    ],
  },
  {
    id: "performance",
    nome: "Performance",
    preco: "149,90",
    destaque: true,
    resumo: "Pra quem quer ajuste fino e resultado constante.",
    itens: [
      "Tudo do Essencial",
      "Check-ins quinzenais guiados",
      "Ajustes de dieta sempre que precisar",
      "Fotos de evolução com comparativo",
      "Resposta prioritária do nutricionista",
    ],
  },
  {
    id: "premium",
    nome: "Premium",
    preco: "249,90",
    resumo: "Acompanhamento next-level, quase 1-a-1.",
    itens: [
      "Tudo do Performance",
      "Consultoria mensal por WhatsApp com Eudes Pereira",
      "Relatório de evolução em PDF a cada ciclo",
      "Prioridade máxima na fila de revisão",
    ],
  },
];

type Aba = "entrar" | "assinar";

export default function PaginaPlanos() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("assinar");
  const [planoEscolhido, setPlanoEscolhido] = useState<Plano["id"]>("performance");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function irPraAssinatura(id: Plano["id"]) {
    setPlanoEscolhido(id);
    setAba("assinar");
    document.getElementById("conta")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, plano: planoEscolhido }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "não consegui criar sua conta");
        return;
      }
      router.push(`/paciente/${d.token}`);
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "e-mail ou senha incorretos");
        return;
      }
      router.push(`/paciente/${d.token}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--color-ink)]">
      {/* header */}
      <header className="bg-[var(--color-brand-strong)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-display text-base font-extrabold text-[var(--color-brand-strong)]">
              N
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">Nutre.AI</span>
          </a>
          <a
            href="#conta"
            onClick={() => setAba("entrar")}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-white  transition hover:bg-white/20"
          >
            Já sou assinante — Entrar
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-linear-to-br from-[var(--color-brand-strong)] via-[var(--color-brand-strong)] to-[var(--color-tech-navy)] px-6 py-20 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--color-tech-cyan)]/20 hidden" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-[var(--color-accent)]/10 hidden" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-tech-cyan)] ">
            Nutricionista Eudes Pereira · CRN 52959
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl">
            Seu plano alimentar, ajustado toda semana — nunca por um algoritmo sozinho.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: "oklch(88% 0.02 155)" }}>
            Converse com o Nutre.AI, registre sua evolução em segundos e receba planos liberados
            por um nutricionista de verdade — sem letra miúda, sem promessa milagrosa.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
              className="px-6 py-3 text-sm"
            >
              Ver planos e assinar
            </Button>
            <a
              href="#conta"
              onClick={() => setAba("entrar")}
              className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50 hover:text-white"
            >
              Já sou assinante
            </a>
          </div>
        </div>
      </section>

      {/* por que assinar */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              titulo: "Revisado por gente de verdade",
              texto: "Nenhum plano sai do forno sem passar pelo Eudes Pereira, CRN 52959.",
            },
            {
              titulo: "Ajuste contínuo",
              texto: "Registrou peso ou medida? A conduta é revista, não é um PDF estático.",
            },
            {
              titulo: "Conversa, não formulário",
              texto: "A avaliação inteira acontece no chat — sem questionário de 40 perguntas.",
            },
          ].map((f) => (
            <Surface key={f.titulo} className="p-5">
              <p className="text-sm font-semibold text-[var(--color-tech-navy)]">{f.titulo}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">{f.texto}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* planos */}
      <section id="planos" className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Planos de assinatura
          </h2>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Valores ilustrativos para demonstração. Cancele quando quiser.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANOS.map((p) =>
            p.destaque ? (
              <div
                key={p.id}
                className="flex flex-col rounded-xl bg-linear-to-br from-[var(--color-tech-navy)] to-[var(--color-tech-navy-strong)] p-6 shadow-[var(--shadow-lifted)] lg:-translate-y-3"
              >
                <PlanoConteudo p={p} irPraAssinatura={irPraAssinatura} />
              </div>
            ) : (
              <Surface key={p.id} className="flex flex-col p-6">
                <PlanoConteudo p={p} irPraAssinatura={irPraAssinatura} />
              </Surface>
            )
          )}
        </div>
      </section>

      {/* conta: entrar / assinar */}
      <section id="conta" className="mx-auto max-w-md px-6 py-16">
        <Surface className="p-6">
          <div className="mb-5 flex gap-1 rounded-full bg-[var(--color-brand-soft)] p-1">
            <button
              onClick={() => setAba("assinar")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                aba === "assinar"
                  ? "bg-white text-[var(--color-tech-navy)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--color-ink-soft)]"
              }`}
            >
              Quero assinar
            </button>
            <button
              onClick={() => setAba("entrar")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                aba === "entrar"
                  ? "bg-white text-[var(--color-tech-navy)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--color-ink-soft)]"
              }`}
            >
              Já sou assinante
            </button>
          </div>

          {aba === "assinar" ? (
            <form onSubmit={assinar} className="space-y-3">
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                Plano
                <select
                  value={planoEscolhido}
                  onChange={(e) => setPlanoEscolhido(e.target.value as Plano["id"])}
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                >
                  {PLANOS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {p.preco}/mês
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                Nome completo
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                E-mail
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="voce@email.com"
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                Crie uma senha
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type="password"
                  placeholder="mínimo 6 caracteres"
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                />
              </label>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <Button type="submit" disabled={ocupado || !nome || !email || !senha} className="w-full">
                {ocupado ? "Criando conta…" : "Criar conta e assinar"}
              </Button>
              <p className="text-center text-[11px] text-[var(--color-ink-soft)]">
                Pagamento ilustrativo — nenhuma cobrança real é feita nesta demonstração.
              </p>
            </form>
          ) : (
            <form onSubmit={entrar} className="space-y-3">
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                E-mail
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="voce@email.com"
                  autoFocus
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
                Senha
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type="password"
                  placeholder="sua senha"
                  className="mt-1 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
                />
              </label>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <Button type="submit" disabled={ocupado || !email || !senha} className="w-full">
                {ocupado ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          )}
        </Surface>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-xs text-[var(--color-ink-soft)]">
        © {new Date().getFullYear()} Nutre.AI · Nutricionista Eudes Pereira — CRN 52959 · Planos e
        valores desta página são ilustrativos.
      </footer>
    </div>
  );
}

function PlanoConteudo({
  p,
  irPraAssinatura,
}: {
  p: Plano;
  irPraAssinatura: (id: Plano["id"]) => void;
}) {
  return (
    <>
      {p.destaque && (
        <span className="mb-3 inline-block w-fit rounded-full bg-[var(--color-tech-cyan)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-tech-navy-strong)]">
          Mais popular
        </span>
      )}
      <h3 className={`text-lg font-bold ${p.destaque ? "text-white" : "text-[var(--color-ink)]"}`}>
        {p.nome}
      </h3>
      <p className={`mt-1 text-sm ${p.destaque ? "text-white/70" : "text-[var(--color-ink-soft)]"}`}>
        {p.resumo}
      </p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className={`text-sm ${p.destaque ? "text-white/70" : "text-[var(--color-ink-soft)]"}`}>
          R$
        </span>
        <span
          className={`text-4xl font-extrabold tabular-nums ${p.destaque ? "text-white" : "text-[var(--color-ink)]"}`}
        >
          {p.preco}
        </span>
        <span className={`text-sm ${p.destaque ? "text-white/70" : "text-[var(--color-ink-soft)]"}`}>
          /mês
        </span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {p.itens.map((item) => (
          <li
            key={item}
            className={`flex items-start gap-2 text-sm ${p.destaque ? "text-white/85" : "text-[var(--color-ink)]"}`}
          >
            <CheckMark cor={p.destaque ? "var(--color-tech-cyan)" : "var(--color-brand)"} />
            {item}
          </li>
        ))}
      </ul>

      <Button
        onClick={() => irPraAssinatura(p.id)}
        variant={p.destaque ? "accent" : "secondary"}
        className="mt-6 w-full justify-center"
      >
        Assinar {p.nome}
      </Button>
    </>
  );
}

function CheckMark({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-current" style={{ color: cor }}>
      <path d="M7.6 13.2 4.4 10l-1.4 1.4 4.6 4.6 8-8L14.2 6.6z" />
    </svg>
  );
}
