"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Checkin {
  id: string;
  data: string;
  peso: number;
  medidas: string;
  origem: string;
  observacao: string | null;
}
interface Foto {
  id: string;
  dados: string;
  angulo: string | null;
  criadoEm: string;
}
interface Props {
  token: string;
  cliente: { nome: string; cidade: string | null; objetivo: string | null };
  temAnamnese: boolean;
  baseline: { pesoKg: number | null; medidas: Record<string, number> };
  planoStatus: "liberado" | "revisao" | "nenhum";
  checkins: Checkin[];
  fotos: Foto[];
}

const MEDIDAS_PRINCIPAIS = ["cintura", "abdomen", "quadril", "braco", "coxa"];

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
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

export default function Dashboard({
  token,
  cliente,
  temAnamnese,
  baseline,
  planoStatus,
  checkins,
  fotos,
}: Props) {
  const router = useRouter();
  const [peso, setPeso] = useState("");
  const [medidas, setMedidas] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const primeiro = cliente.nome.split(" ")[0];
  const pesoAtual = checkins.length ? checkins[checkins.length - 1].peso : baseline.pesoKg;
  const deltaPeso =
    baseline.pesoKg != null && pesoAtual != null ? pesoAtual - baseline.pesoKg : null;

  async function salvarMedicao(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSalvando(true);
    try {
      const medidasNum: Record<string, number> = {};
      for (const [k, v] of Object.entries(medidas)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) medidasNum[k] = n;
      }
      const r = await fetch(`/api/paciente/${token}/medicao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peso, medidas: medidasNum, observacao: obs }),
      });
      if (r.ok) {
        setPeso("");
        setMedidas({});
        setObs("");
        setMsg("Registro salvo! 🎉");
        router.refresh();
      } else {
        setMsg((await r.json().catch(() => ({}))).erro ?? "erro ao salvar");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    setMsg(null);
    try {
      const dados = await reduzirImagem(file);
      const r = await fetch(`/api/paciente/${token}/foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados }),
      });
      if (r.ok) {
        setMsg("Foto enviada! 📸");
        router.refresh();
      } else {
        setMsg((await r.json().catch(() => ({}))).erro ?? "erro ao enviar foto");
      }
    } catch {
      setMsg("não consegui processar a imagem");
    } finally {
      setEnviandoFoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const statusInfo = {
    liberado: { txt: "Seu plano está liberado! Abra a conversa para ver.", cor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    revisao: { txt: "Seu plano está em revisão com o nutricionista. Avisamos aqui assim que liberar.", cor: "bg-amber-50 text-amber-800 border-amber-200" },
    nenhum: { txt: temAnamnese ? "Estamos preparando sua avaliação." : "Comece sua avaliação iniciando a consulta.", cor: "bg-gray-50 text-gray-700 border-gray-200" },
  }[planoStatus];

  return (
    <div className="min-h-dvh bg-gray-100 pb-16">
      <header className="bg-emerald-700 px-4 py-5 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-sm text-emerald-100">Olá,</p>
            <h1 className="text-xl font-bold">{primeiro} 👋</h1>
          </div>
          <a
            href={`/c/${token}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow hover:bg-emerald-50"
          >
            {temAnamnese ? "Abrir conversa" : "Iniciar consulta"}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className={`rounded-xl border p-4 text-sm ${statusInfo.cor}`}>{statusInfo.txt}</div>

        {/* resumo rápido */}
        <div className="grid grid-cols-3 gap-3">
          <Stat rotulo="Objetivo" valor={cliente.objetivo ?? "—"} />
          <Stat rotulo="Peso atual" valor={pesoAtual != null ? `${pesoAtual} kg` : "—"} />
          <Stat
            rotulo="Desde o início"
            valor={deltaPeso != null ? `${deltaPeso > 0 ? "+" : ""}${deltaPeso.toFixed(1)} kg` : "—"}
            destaque={deltaPeso != null && deltaPeso < 0 ? "verde" : undefined}
          />
        </div>

        {/* dados iniciais */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Seus dados iniciais</h2>
          {baseline.pesoKg == null && Object.keys(baseline.medidas).length === 0 ? (
            <p className="text-sm text-gray-500">
              Ainda não temos seus dados iniciais. Eles são preenchidos na sua consulta com o Nutre.AI —
              ou registre abaixo o seu ponto de partida.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              {baseline.pesoKg != null && <span>Peso inicial: <b>{baseline.pesoKg} kg</b></span>}
              {Object.entries(baseline.medidas).map(([k, v]) => (
                <span key={k}>{k}: <b>{v} cm</b></span>
              ))}
            </div>
          )}
        </section>

        {/* registrar medição */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Registrar acompanhamento</h2>
          <p className="mb-3 text-xs text-gray-500">
            Anote seu peso e medidas quando quiser. Isso ajuda a acompanhar sua evolução (não gera dieta nova).
          </p>
          <form onSubmit={salvarMedicao} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="text-xs font-medium text-gray-600">
                Peso (kg) *
                <input
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  type="number"
                  step="0.1"
                  placeholder="Ex.: 84.5"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-emerald-600"
                />
              </label>
              {MEDIDAS_PRINCIPAIS.map((m) => (
                <label key={m} className="text-xs font-medium text-gray-600 capitalize">
                  {m} (cm)
                  <input
                    value={medidas[m] ?? ""}
                    onChange={(e) => setMedidas((s) => ({ ...s, [m]: e.target.value }))}
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-emerald-600"
                  />
                </label>
              ))}
            </div>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Observação (opcional) — ex.: como você está se sentindo"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={salvando || !peso}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar registro"}
            </button>
          </form>
          {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
        </section>

        {/* evolução */}
        {checkins.length > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Sua evolução</h2>
            <div className="space-y-1.5">
              {[...checkins].reverse().map((c) => {
                const med = safeParse(c.medidas);
                return (
                  <div key={c.id} className="flex items-baseline justify-between border-b border-gray-100 py-1.5 text-sm last:border-0">
                    <span className="text-gray-500">{fmtData(c.data)}</span>
                    <span className="font-medium text-gray-900">{c.peso} kg</span>
                    <span className="text-xs text-gray-400">
                      {Object.entries(med).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" · ") || (c.origem === "chat" ? "check-in" : "registro")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* fotos */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Fotos de evolução</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={enviandoFoto}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {enviandoFoto ? "Enviando…" : "+ Anexar foto"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={subirFoto} className="hidden" />
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Opcional. Suas fotos são confidenciais, usadas só para acompanhar sua evolução, com acesso restrito ao nutricionista.
          </p>
          {fotos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma foto ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f.id}
                  src={f.dados}
                  alt={`Foto ${fmtData(f.criadoEm)}`}
                  onClick={() => setZoom(f.dados)}
                  className="aspect-square w-full cursor-pointer rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Stat({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: "verde" }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{rotulo}</div>
      <div className={`mt-0.5 text-sm font-bold ${destaque === "verde" ? "text-emerald-700" : "text-gray-900"}`}>
        {valor}
      </div>
    </div>
  );
}

function safeParse(s: string): Record<string, number> {
  try {
    return JSON.parse(s) as Record<string, number>;
  } catch {
    return {};
  }
}
