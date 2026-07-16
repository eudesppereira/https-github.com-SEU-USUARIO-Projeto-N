"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--color-tech-navy)]">
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-[var(--color-tech-cyan)]/12 hidden" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[var(--color-brand-mid)]/15 hidden" />
      <form
        onSubmit={entrar}
        className="relative w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-white/[0.06] p-8 text-white shadow-[var(--shadow-lifted)] "
      >
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-tech-cyan)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-tech-cyan)] shadow-[0_0_8px_2px_var(--color-tech-cyan)]" />
            Área do profissional
          </div>
          <h1 className="text-xl font-bold">Nutre.AI — Painel</h1>
          <p className="text-sm text-white/60">Acesso do nutricionista</p>
        </div>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-white/40 focus:border-[var(--color-tech-cyan)] focus:ring-2 focus:ring-[var(--color-tech-cyan)]/25"
        />
        {erro && <p className="text-sm text-red-300">{erro}</p>}
        <Button type="submit" disabled={carregando || !senha} className="w-full">
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
