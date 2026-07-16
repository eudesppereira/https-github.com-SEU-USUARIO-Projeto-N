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

const MEDIDAS: { chave: string; rotulo: string }[] = [
  { chave: "punho", rotulo: "Punho" },
  { chave: "antebraco", rotulo: "Antebraço" },
  { chave: "braco", rotulo: "Braço" },
  { chave: "peitoral", rotulo: "Peitoral" },
  { chave: "cintura", rotulo: "Cintura" },
  { chave: "abdomen", rotulo: "Abdômen (umbigo)" },
  { chave: "quadril", rotulo: "Quadril" },
  { chave: "coxa", rotulo: "Coxa" },
  { chave: "panturrilha", rotulo: "Panturrilha" },
  { chave: "tornozelo", rotulo: "Tornozelo" },
];

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
  const seriePeso = [baseline.pesoKg, ...checkins.map((c) => c.peso)].filter(
    (v): v is number => v != null,
  );

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
    liberado: { txt: "Seu plano está liberado! Abra a conversa para ver.", cor: "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]" },
    revisao: { txt: "Seu plano está em revisão com o nutricionista. Avisamos aqui assim que liberar.", cor: "border-amber-200 bg-amber-50 text-amber-800" },
    nenhum: { txt: temAnamnese ? "Estamos preparando sua avaliação." : "Comece sua avaliação iniciando a consulta.", cor: "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-soft)]" },
  }[planoStatus];

  return (
    <div className="min-h-dvh bg-[var(--background)] pb-16">
      <header className="bg-[var(--color-brand-strong)] px-4 py-5 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: "oklch(85% 0.02 155)" }}>Olá,</p>
            <h1 className="text-xl font-semibold">{primeiro} 👋</h1>
          </div>
          <a
            href={`/c/${token}`}
            className="rounded-sm bg-white px-4 py-2 text-sm font-semibold text-[var(--color-brand-strong)] transition hover:bg-[var(--color-brand-soft)]"
          >
            {temAnamnese ? "Abrir conversa" : "Iniciar consulta"}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className={`rounded-sm border p-3 text-sm ${statusInfo.cor}`}>{statusInfo.txt}</div>

        {/* resumo — uma única faixa com divisores, não três cards soltos */}
        <div className="grid grid-cols-3 divide-x divide-[var(--color-line)] rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)]">
          <Stat rotulo="Objetivo" valor={cliente.objetivo ?? "—"} />
          <Stat rotulo="Peso atual" valor={pesoAtual != null ? `${pesoAtual} kg` : "—"} />
          <Stat
            rotulo="Desde o início"
            valor={deltaPeso != null ? `${deltaPeso > 0 ? "+" : ""}${deltaPeso.toFixed(1)} kg` : "—"}
            destaque={deltaPeso != null && deltaPeso < 0 ? "energia" : undefined}
          />
        </div>

        {seriePeso.length >= 2 && (
          <section className="rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Seu peso no tempo</h2>
              <span className="text-xs text-[var(--color-ink-soft)] tabular-nums">
                {seriePeso[0]} kg → {seriePeso[seriePeso.length - 1]} kg
              </span>
            </div>
            <Sparkline valores={seriePeso} />
          </section>
        )}

        {/* acompanhamento: dados iniciais, registro e histórico num único painel,
            separados por hairline em vez de três cards empilhados */}
        <section className="rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Seus dados iniciais</h2>
            {baseline.pesoKg == null && Object.keys(baseline.medidas).length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                Ainda não temos seus dados iniciais. Eles são preenchidos na sua consulta com o Nutre.AI —
                ou registre abaixo o seu ponto de partida.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-ink)]">
                {baseline.pesoKg != null && (
                  <span>
                    Peso inicial: <b className="tabular-nums">{baseline.pesoKg} kg</b>
                  </span>
                )}
                {Object.entries(baseline.medidas).map(([k, v]) => (
                  <span key={k}>
                    {k}: <b className="tabular-nums">{v} cm</b>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-line)] p-4">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-ink)]">Registrar acompanhamento</h2>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              Anote seu peso e medidas quando quiser. Isso ajuda a acompanhar sua evolução (não gera dieta nova).
            </p>
            <form onSubmit={salvarMedicao} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="text-xs font-medium text-[var(--color-ink-soft)]">
                  Peso (kg) *
                  <input
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    type="number"
                    step="0.1"
                    placeholder="Ex.: 84.5"
                    className="mt-1 w-full rounded-sm border border-[var(--color-line-strong)] px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
                  />
                </label>
                {MEDIDAS.map(({ chave, rotulo }) => (
                  <label key={chave} className="text-xs font-medium text-[var(--color-ink-soft)]">
                    {rotulo} (cm)
                    <input
                      value={medidas[chave] ?? ""}
                      onChange={(e) => setMedidas((s) => ({ ...s, [chave]: e.target.value }))}
                      type="number"
                      step="0.1"
                      className="mt-1 w-full rounded-sm border border-[var(--color-line-strong)] px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
                    />
                  </label>
                ))}
              </div>
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Observação (opcional) — ex.: como você está se sentindo"
                className="w-full rounded-sm border border-[var(--color-line-strong)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
              />
              <button
                type="submit"
                disabled={salvando || !peso}
                className="rounded-sm bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-strong)] disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar registro"}
              </button>
            </form>
            {msg && <p className="mt-2 text-sm text-[var(--color-brand)]">{msg}</p>}
          </div>

          {checkins.length > 0 && (
            <div className="border-t border-[var(--color-line)] p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Sua evolução</h2>
              <div>
                {[...checkins].reverse().map((c) => {
                  const med = safeParse(c.medidas);
                  return (
                    <div key={c.id} className="flex items-baseline justify-between border-b border-[var(--color-line)] py-1.5 text-sm last:border-0">
                      <span className="text-[var(--color-ink-soft)]">{fmtData(c.data)}</span>
                      <span className="font-medium tabular-nums text-[var(--color-ink)]">{c.peso} kg</span>
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {Object.entries(med).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" · ") || (c.origem === "chat" ? "check-in" : "registro")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* fotos */}
        <section className="rounded-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Fotos de evolução</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={enviandoFoto}
              className="rounded-sm bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-strong)] disabled:opacity-50"
            >
              {enviandoFoto ? "Enviando…" : "+ Anexar foto"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={subirFoto} className="hidden" />
          </div>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Opcional. Suas fotos são confidenciais, usadas só para acompanhar sua evolução, com acesso restrito ao nutricionista.
          </p>
          {fotos.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Nenhuma foto ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f.id}
                  src={f.dados}
                  alt={`Foto ${fmtData(f.criadoEm)}`}
                  onClick={() => setZoom(f.dados)}
                  className="aspect-square w-full cursor-pointer rounded-sm object-cover"
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
          <img src={zoom} alt="Foto ampliada" className="max-h-full max-w-full rounded-sm" />
        </div>
      )}
    </div>
  );
}

function Stat({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: "energia" }) {
  return (
    <div className="p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-soft)]">{rotulo}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          destaque === "energia" ? "text-[var(--color-accent-strong)]" : "text-[var(--color-ink)]"
        }`}
      >
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

// Elemento-assinatura: a linha do peso no tempo. SVG puro, sem lib.
function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const w = 600;
  const h = 120;
  const pad = 8;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const px = (i: number) => pad + (i * (w - pad * 2)) / (valores.length - 1);
  const py = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const linha = valores.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `${linha} L${px(valores.length - 1).toFixed(1)},${h - pad} L${px(0).toFixed(1)},${h - pad} Z`;
  const desce = valores[valores.length - 1] <= valores[0];
  const cor = desce ? "var(--color-brand-mid)" : "var(--color-accent-strong)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-20 w-full" role="img" aria-label="Evolução do peso ao longo do tempo">
      <path d={area} fill={cor} opacity={0.08} />
      <path d={linha} fill="none" stroke={cor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {valores.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={i === valores.length - 1 ? 4 : 2.5} fill={cor} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
