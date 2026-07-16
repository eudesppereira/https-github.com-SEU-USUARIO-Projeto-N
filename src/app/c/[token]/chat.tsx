"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  conteudo: string;
}

// reduz a imagem no navegador antes de enviar (evita uploads gigantes)
function reduzirImagem(file: File, maxDim = 1200, qualidade = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const escala = maxDim / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("sem canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  async function iniciarConversa() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/chat/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.mensagens?.length) {
        setMensagens((m) => [...m, ...d.mensagens]);
      } else {
        setErro(
          d.erro ??
            "Não consegui iniciar a conversa agora. Toque em “Tentar de novo”."
        );
      }
    } catch {
      setErro("Sem conexão. Toque em “Tentar de novo”.");
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (mensagensIniciais.length === 0 && !iniciou.current) {
      iniciou.current = true;
      iniciarConversa();
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

  async function anexarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || enviandoFoto) return;
    setErro(null);
    setEnviandoFoto(true);
    try {
      const dados = await reduzirImagem(file);
      const r = await fetch(`/api/paciente/${token}/foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados }),
      });
      if (!r.ok) {
        setErro((await r.json().catch(() => ({}))).erro ?? "Não consegui enviar a foto.");
        return;
      }
      // registra no chat e deixa o bot acolher o envio
      const local: Msg = { id: `foto-${Date.now()}`, role: "user", conteudo: "📷 Enviei uma foto para acompanhamento." };
      setMensagens((m) => [...m, local]);
      setEnviando(true);
      const rc = await fetch(`/api/chat/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: "📷 Acabei de enviar uma foto para acompanhamento da minha evolução." }),
      });
      const d = await rc.json();
      if (rc.ok && d.mensagens) setMensagens((m) => [...m, ...d.mensagens]);
    } catch {
      setErro("Não consegui processar a imagem.");
    } finally {
      setEnviando(false);
      setEnviandoFoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--background)]">
      <header className="flex items-center gap-3 bg-[var(--color-brand-strong)] px-4 py-3 text-white shadow">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand)] text-lg font-bold">
          N
        </div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">Nutre.AI</div>
          <div className="text-xs text-white/70">
            Nutricionista Eudes Pereira · CRN 52959
          </div>
        </div>
        <a
          href={`/paciente/${token}`}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
        >
          Meu painel
        </a>
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
                  ? "rounded-br-none bg-[var(--color-brand-soft)] text-[var(--color-ink)]"
                  : "rounded-bl-none border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
              }`}
            >
              {formatar(m.conteudo)}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-line-strong)] [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-line-strong)] [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-line-strong)] [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        {erro && (
          <div className="mx-auto max-w-[85%] space-y-2 rounded bg-red-100 px-3 py-2 text-center text-sm text-red-700">
            <div>{erro}</div>
            {mensagens.length === 0 && !enviando && (
              <button
                onClick={iniciarConversa}
                className="rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Tentar de novo
              </button>
            )}
          </div>
        )}
        <div ref={fimRef} />
      </main>

      <footer className="flex items-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={anexarFoto} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={enviandoFoto || enviando}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-brand)] hover:bg-black/5 disabled:opacity-40"
          aria-label="Anexar foto"
          title="Anexar foto"
        >
          {enviandoFoto ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
              <path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z" />
            </svg>
          )}
        </button>
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
          className="max-h-32 flex-1 resize-none rounded-full border-none bg-white px-4 py-2.5 text-[15px] text-gray-900 outline-none"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-white disabled:opacity-40"
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
