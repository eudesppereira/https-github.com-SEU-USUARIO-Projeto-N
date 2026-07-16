"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginAdmin() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    setCarregando(false);
    if (r.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setErro(d.erro ?? "erro ao entrar");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm space-y-4 rounded-sm bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)]">Nutre.AI — Painel</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">Acesso do nutricionista</p>
        </div>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="w-full rounded-sm border border-[var(--color-line-strong)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={carregando || !senha}
          className="w-full rounded-sm bg-[var(--color-brand)] py-2 font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
