"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NavAdmin() {
  const router = useRouter();
  async function sair() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-[var(--color-tech-navy)] px-6 py-3 text-white shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 font-bold">
          <span className="h-2 w-2 rounded-full bg-[var(--color-tech-cyan)] shadow-[0_0_10px_2px_var(--color-tech-cyan)]" />
          Nutre.AI <span className="font-normal text-white/40">· profissional</span>
        </span>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="text-white/70 transition hover:text-[var(--color-tech-cyan)]">
            Fila de revisão
          </Link>
          <Link href="/admin/clientes" className="text-white/70 transition hover:text-[var(--color-tech-cyan)]">
            Clientes
          </Link>
        </nav>
      </div>
      <button onClick={sair} className="text-sm text-white/60 transition hover:text-red-400">
        Sair
      </button>
    </header>
  );
}
