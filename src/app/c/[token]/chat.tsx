"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  conteudo: string;
}

// *negrito* estilo WhatsApp + quebras de linha
function formatar(texto: string) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return partes.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <strong key={i}>{p.slice(1, -1)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function Chat({
  token,
  mensagensIniciais,
}: {
  token: string;
  mensagensIniciais: Msg[];
}) {
  const [mensagens, setMensagens] = useState<Msg[]>(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (mensagensIniciais.length === 0 && !iniciou.current) {
      iniciou.current = true;
      setEnviando(true);
      fetch(`/api/chat/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: true }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.mensagens) setMensagens((m) => [...m, ...d.mensagens]);
        })
        .finally(() => setEnviando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setErro(null);
    setTexto("");
    const local: Msg = { id: `local-${Date.now()}`, role: "user", conteudo: t };
    setMensagens((m) => [...m, local]);
    setEnviando(true);
    try {
      const r = await fetch(`/api/chat/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: t }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Erro ao enviar. Tente de novo.");
      } else if (d.mensagens) {
        setMensagens((m) => [...m, ...d.mensagens]);
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[#e5ddd5]">
      <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white shadow">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#128c7e] text-lg font-bold">
          N
        </div>
        <div>
          <div className="font-semibold leading-tight">Nutre.AI</div>
          <div className="text-xs text-emerald-100">
            Nutricionista Eudes Pereira · CRN 52959
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[15px] leading-snug shadow-sm ${
                m.role === "user"
                  ? "rounded-br-none bg-[#dcf8c6] text-gray-900"
                  : "rounded-bl-none bg-white text-gray-900"
              }`}
            >
              {formatar(m.conteudo)}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none bg-white px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        {erro && (
          <div className="mx-auto max-w-[85%] rounded bg-red-100 px-3 py-2 text-center text-sm text-red-700">
            {erro}
          </div>
        )}
        <div ref={fimRef} />
      </main>

      <footer className="flex items-end gap-2 bg-[#f0f0f0] px-3 py-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          placeholder="Digite sua mensagem"
          className="max-h-32 flex-1 resize-none rounded-full border-none bg-white px-4 py-2.5 text-[15px] outline-none"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075e54] text-white disabled:opacity-40"
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
