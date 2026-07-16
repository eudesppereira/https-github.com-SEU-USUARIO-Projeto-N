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
    <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-bold text-[var(--color-brand)]">Nutre.AI</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="text-[var(--color-ink)] hover:text-[var(--color-brand)]">
            Fila de revisão
          </Link>
          <Link href="/admin/clientes" className="text-[var(--color-ink)] hover:text-[var(--color-brand)]">
            Clientes
          </Link>
        </nav>
      </div>
      <button onClick={sair} className="text-sm text-[var(--color-ink-soft)] hover:text-red-600">
        Sair
      </button>
    </header>
  );
}
