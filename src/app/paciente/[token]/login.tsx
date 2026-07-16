"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function LoginPaciente({ token, nome }: { token: string; nome: string }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const r = await fetch(`/api/paciente/${token}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    setCarregando(false);
    if (r.ok) router.refresh();
    else setErro((await r.json().catch(() => ({}))).erro ?? "erro ao entrar");
  }

  const primeiro = nome.split(" ")[0];

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--color-brand-soft)] hidden" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[var(--color-tech-cyan)]/15 hidden" />
      <form
        onSubmit={entrar}
        className="relative w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-lifted)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[var(--color-brand)] to-[var(--color-tech-navy)] text-base font-bold text-white">
            N
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-ink)]">Olá, {primeiro}</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">Entre no seu painel Nutre.AI</p>
          </div>
        </div>

        <label className="mb-4 block text-sm font-medium text-[var(--color-ink)]">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-[var(--color-line-strong)] px-3 py-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan-soft)]"
          />
        </label>

        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

        <Button type="submit" disabled={carregando || !senha} className="w-full">
          {carregando ? "Entrando…" : "Entrar"}
        </Button>

        <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">
          Não tem senha? Use o link exclusivo que você recebeu.
        </p>
      </form>
    </div>
  );
}
