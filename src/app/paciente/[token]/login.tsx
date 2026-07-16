"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-8 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.35)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--color-brand)] text-base font-bold text-white">
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
            className="mt-1.5 w-full rounded-sm border border-[var(--color-line-strong)] px-3 py-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
          />
        </label>

        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando || !senha}
          className="w-full rounded-sm bg-[var(--color-brand)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-strong)] disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>

        <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">
          Não tem senha? Use o link exclusivo que você recebeu.
        </p>
      </form>
    </div>
  );
}
