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
    <div className="flex min-h-dvh items-center justify-center bg-gray-100">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nutre.AI — Painel</h1>
          <p className="text-sm text-gray-500">Acesso do nutricionista</p>
        </div>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-600"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={carregando || !senha}
          className="w-full rounded-lg bg-emerald-700 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
