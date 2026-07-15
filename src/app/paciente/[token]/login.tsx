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
    <div className="flex min-h-dvh items-center justify-center bg-gray-100 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white">
            N
          </div>
          <h1 className="text-lg font-bold text-gray-900">Olá, {primeiro}!</h1>
          <p className="text-sm text-gray-500">Entre no seu painel Nutre.AI</p>
        </div>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Sua senha"
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={carregando || !senha}
          className="w-full rounded-lg bg-emerald-700 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-xs text-gray-400">
          Não tem senha? Use o link exclusivo que você recebeu.
        </p>
      </form>
    </div>
  );
}
