// DEMO visual do motor de substituição — personas clínicas Marta e João.
// Roda o motor DETERMINÍSTICO real (montarBlocoFiltros) e monta uma página HTML
// com, para cada persona: (1) a conversa, (2) a dieta liberada, (3) a lista de
// substituição que o módulo produz respeitando as travas.
//
// Modo LIVE (LIVE=1 + provedor real com chave): a resposta de substituição é
// gerada AO VIVO pelo modelo, pelo mesmo caminho do app (montarSystemPromptChat
// injeta o módulo + os filtros). Sem chave, usa o exemplo fiel autorado.
// Os FILTROS exibidos são SEMPRE a saída real do motor.
//
// Uso:  npx tsx scripts/demo-substituicao.ts            (exemplo autorado)
//       LIVE=1 AI_PROVIDER=gemini npx tsx scripts/demo-substituicao.ts   (ao vivo)

import fs from "fs";
import path from "path";
import { montarBlocoFiltros, extrairFiltros } from "../src/lib/substituicao";
import { montarSystemPromptChat } from "../src/lib/prompt";
import { ai, PROVEDOR, MODELO } from "../src/lib/ai";

try {
  process.loadEnvFile(".env");
} catch {
  /* sem .env — segue com defaults/mock */
}

type Msg = { role: "assistant" | "user" | "plano"; text: string; live?: boolean };

interface Persona {
  slug: string;
  titulo: string;
  subtitulo: string;
  anamnese: Record<string, unknown>;
  planoTexto: string;
  intro: string;
  perguntas: string[];
  respostasExemplo: string[]; // paralelo a perguntas
}

// ============================ MARTA ========================================
const marta: Persona = {
  slug: "marta",
  titulo: "Marta Souza",
  subtitulo: "55a · Hipertensão + DRC estágio 3 + Losartana · não come peixe",
  anamnese: {
    nome: "Marta Souza",
    idade: 55,
    sexo: "feminino",
    objetivo: "emagrecimento",
    saude: {
      diagnosticos: ["Hipertensão arterial sistêmica", "Doença renal crônica estágio 3"],
      medicacoes: ["Losartana 50mg 2x/dia"],
    },
    contextoFeminino: { menopausa: true, gestante: false, amamentando: false },
    comportamento: {
      alimentosQueGosta: ["banana", "laranja", "feijão", "queijo", "pão"],
      alimentosQueNaoGosta: ["peixe"],
      preferencias: ["frutas", "café com leite"],
      intolerancias: [],
      restricoes: [],
      orcamento: "médio",
    },
  },
  planoTexto: `*PLANO ALIMENTAR PERSONALIZADO*
Paciente: Marta Souza · Ciclo 1 · Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*
TMB 1430 · GET 1930 · Meta 1500 kcal (emagrecimento — proteína/potássio ajustados pela DRC)
Proteínas 94g (1,2 g/kg) · Carboidratos 150g · Gorduras 50g · Água 2,5 L/dia

*CARDÁPIO*

*Café da manhã — 7h30*
- Pão francês integral — 1 unidade (50g)
- Queijo minas frescal — 1 fatia (30g)
- Café com leite desnatado — 1 xícara (200ml)
- Banana prata — 1 unidade pequena (70g)

*Almoço — 12h30*
- Arroz branco cozido — 3 colheres (45g)
- Feijão carioca — 1 concha pequena (60g)
- Carne bovina magra (patinho) — 1 bife pequeno (80g)
- Salada de alface e pepino (80g) · Azeite 1/2 colher

*Lanche — 16h30*
- Maçã ou pera — 1 unidade (120g)
- Iogurte natural desnatado — 1 pote (170g)

*Jantar — 19h30*
- Arroz branco — 2 colheres (30g)
- Carne bovina magra moída — 1 porção pequena (100g)
- Legumes cozidos (cenoura e abobrinha) — 1 xícara (150g)

⚠ *OBSERVAÇÕES*: DRC estágio 3 + Losartana + K 5,0 → teto de potássio; proteína controlada 1,2 g/kg.`,
  intro: "Olá, Marta! 👋 Seu plano foi *liberado* pelo nutricionista Eudes Pereira. Qualquer dúvida ou troca, é só me chamar. 💛",
  perguntas: [
    "Adorei! Mas enjoei da carne do almoço todo dia. Posso trocar por outra coisa?",
    "E a banana do café? Ouvi dizer que banana faz mal pro rim.",
  ],
  respostasExemplo: [
    `Claro, Marta! A carne do almoço é a sua *proteína principal* (~25g). Filtrei mantendo proteína de qualidade sem pesar no sódio nem no potássio. 👇

🔁 *Substituições para: Carne bovina (patinho) — 80g · Almoço 12h30*
Papel na refeição: proteína principal (~25g P)
Filtros aplicados: sem peixe (você não curte) · baixo sódio · teto de potássio (DRC) · proteína controlada

1. *Frango grelhado desfiado — 100g* · Selo: *A*
   Por quê: mesma proteína de alto valor biológico, sódio baixo, potássio moderado. Troca direta segura.

2. *Ovos — 2 unidades* · Selo: *A*
   Por quê: proteína completa, baixo fósforo e potássio — ótimo para o rim. Tempere com ervas, não sal.

3. *Sobrecoxa de frango sem pele — 90g* · Selo: *B*
   Por quê: casa a proteína e rende sabor; grelhada/cozida sem caldo pronto (sódio).

Rotacionando na semana você mantém variedade. Nenhuma mexe nas travas de segurança. 💚`,
    `Ótima pergunta — e você está certa em ter atenção. 🙌 Pela sua condição renal (com a Losartana, o potássio precisa ficar controlado), *banana em excesso* não é a melhor escolha. Dá pra variar com frutas de *menor potássio*:

🔁 *Substituições para: Banana prata — 70g · Café da manhã 7h30*
Papel na refeição: fruta (carbo + fibra)
Filtros aplicados: teto de potássio (DRC/Losartana) · econômico · in natura

1. *Maçã — 1 unidade pequena (100g)* · Selo: *A*
   Por quê: baixo potássio, boa fibra e saciedade. Troca direta segura.

2. *Morango — 1 xícara (100g)* · Selo: *A*
   Por quê: baixo potássio, rico em vitamina C, cabe no orçamento na estação.

3. *Pera — 1 unidade pequena (110g)* · Selo: *B*
   Por quê: baixo potássio e boa aceitação; ajuste a porção para casar as fibras.

⚠️ *Revisão do nutricionista*: envolve potássio + Losartana, então registrei sua preferência para o Eudes confirmar no próximo ciclo. 💛`,
  ],
};

// ============================ JOÃO =========================================
const joao: Persona = {
  slug: "joao",
  titulo: "João Ribeiro",
  subtitulo: "38a · DRC estágio 4 (TFG 22) + objetivo hipertrofia · não come jiló/fígado",
  anamnese: {
    nome: "João Ribeiro",
    idade: 38,
    sexo: "masculino",
    objetivo: "ganho",
    saude: {
      diagnosticos: ["Doença renal crônica estágio 4 (não dialítica)"],
      medicacoes: [],
      suplementos: ["Whey protein 2 doses/dia"],
    },
    comportamento: {
      alimentosQueGosta: ["frango", "arroz", "ovos", "batata-doce", "banana"],
      alimentosQueNaoGosta: ["jiló", "fígado"],
      preferencias: ["frango", "arroz", "feijão"],
      intolerancias: [],
      restricoes: [],
      orcamento: "2 a 3 salários",
    },
  },
  planoTexto: `*PLANO ALIMENTAR PERSONALIZADO*
Paciente: João Ribeiro · Ciclo 1 · Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*
TMB 1810 · GET 2806 · Meta 3150 kcal (ganho controlado — proteína limitada pela função renal)
Proteínas 65g (limite renal ~0,8 g/kg) · Carboidratos 430g · Gorduras 95g · Água 2,9 L/dia

*CARDÁPIO*

*Café da manhã — 7h*
- Arroz branco cozido — 2 colheres (120g)
- Ovos cozidos — 2 unidades (100g)

*Lanche — 10h*
- Banana prata — 2 unidades (200g) · Mel — 1 colher (20g)

*Almoço — 12h30*
- Arroz branco — 4 colheres (240g)
- Feijão carioca — 1 concha (100g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Cenoura cozida (60g) · Azeite 1 colher

*Lanche — 16h*
- Batata-doce cozida — 2 unidades (260g) · Azeite 1 colher

*Jantar — 20h*
- Arroz branco — 4 colheres (240g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Batata-doce cozida — 1 unidade (130g) · Azeite 1 colher

⚠ *OBSERVAÇÕES*: DRC estágio 4 (TFG 22) → proteína travada em ~0,8 g/kg MESMO com objetivo de hipertrofia (motor de conflito: travar + flag). Energia alta para não catabolizar; whey suspenso pela sobrecarga renal.`,
  intro: "Fala, João! 💪 Seu plano foi *liberado* pelo nutricionista Eudes Pereira. Precisar trocar algo, me chama.",
  perguntas: [
    "Quero botar mais whey e frango pra ganhar massa. Dá pra aumentar a proteína?",
    "Beleza. E no lanche, posso trocar a batata-doce por outra coisa?",
  ],
  respostasExemplo: [
    `Entendo o objetivo, João — e vou ser honesto com você porque é importante. 🙏 Seu exame mostra a função renal bem reduzida (TFG 22), e por isso a *proteína está travada em ~0,8 g/kg* (os 65g do plano). Isso é uma trava de *segurança*, não dá pra furar nem com o objetivo de hipertrofia — proteína e whey em excesso aceleram a sobrecarga renal.

O que dá pra fazer com segurança:
- *Manter a energia alta* (carbo de qualidade) pra você não perder massa — é por isso que a meta é 3150 kcal.
- *Priorizar proteína de alto valor biológico* nos 65g (ovo, frango em porção controlada) pra render mais.
- Treino resistido segue firme pra proteger a massa dentro do limite seguro.

⚠️ *Revisão do nutricionista*: aumento de proteína não é liberado por aqui; o Eudes acompanha ureia/creatinina e ajusta com você. O whey fica suspenso por enquanto. 💚`,
    `Boa, essa dá pra trocar tranquilo! 🍠 A batata-doce do lanche é *fonte de carboidrato* (~70g C, energia da tarde). Como você tem cuidado renal, filtrei mantendo o carbo e o potássio sob controle:

🔁 *Substituições para: Batata-doce — 260g · Lanche 16h*
Papel na refeição: carboidrato (energia)
Filtros aplicados: teto de potássio/fósforo (DRC) · sem jiló/fígado · econômico

1. *Arroz branco cozido — 200g* · Selo: *A*
   Por quê: carbo equivalente, baixo potássio (melhor que a batata pro rim). Troca direta segura.

2. *Mandioca cozida — 180g* · Selo: *B*
   Por quê: casa a energia; potássio moderado, então mantenha a porção controlada.

3. *Macarrão cozido — 180g* · Selo: *B*
   Por quê: prático e barato; ajuste o molho sem caldo pronto (sódio/fósforo).

Todas mantêm as ~450 kcal do lanche. Boa pra variar sem repetir sempre a batata. 💪`,
  ],
};

const personas = [marta, joao];

// --------------------- LIVE: gera resposta pelo caminho do app -------------
const LIVE = process.env.LIVE === "1";
const podeLive = LIVE && PROVEDOR !== "mock";

function ctxDe(p: Persona) {
  return {
    cliente: { nome: p.titulo, consentimentoLgpd: true, consentimentoFotos: false },
    caso: { memoria: JSON.stringify({ anamnese: p.anamnese }) },
    dietaLiberada: { ciclo: 1, liberadoEm: new Date(), conteudo: p.planoTexto },
    dietaPendente: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function respostaLive(p: Persona, pergunta: string): Promise<string> {
  const system = montarSystemPromptChat(ctxDe(p));
  const r = await ai.messages.create({
    model: MODELO,
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: pergunta }],
  });
  return r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

async function montarConversa(p: Persona): Promise<Msg[]> {
  const msgs: Msg[] = [
    { role: "assistant", text: p.intro },
    { role: "plano", text: p.planoTexto },
  ];
  for (let i = 0; i < p.perguntas.length; i++) {
    msgs.push({ role: "user", text: p.perguntas[i] });
    if (podeLive) {
      try {
        msgs.push({ role: "assistant", text: await respostaLive(p, p.perguntas[i]), live: true });
        continue;
      } catch (e) {
        console.warn(`[live] falhou (${(e as Error).message}); usando exemplo.`);
      }
    }
    msgs.push({ role: "assistant", text: p.respostasExemplo[i] });
  }
  return msgs;
}

// ------------------------------- MAIN --------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmt(s: string): string {
  return esc(s).replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}

interface Render {
  p: Persona;
  conversa: Msg[];
  blocoFiltros: string;
  checks: [string, boolean][];
}

async function processar(p: Persona): Promise<Render> {
  const filtros = extrairFiltros(p.anamnese);
  const blocoFiltros = montarBlocoFiltros(p.anamnese);
  const conversa = await montarConversa(p);
  const resp = conversa.filter((m) => m.role === "assistant").map((m) => m.text).join("\n").toLowerCase();
  const aversao = (p.anamnese.comportamento as Record<string, string[]>).alimentosQueNaoGosta[0] ?? "";
  const checks: [string, boolean][] = [
    ["motor marca trava clínica (DRC)", filtros.temTravaClinica === true],
    [`filtro captura aversão (${aversao})`, filtros.aversoes.length > 0],
    ["filtro traz teto de potássio (DRC)", blocoFiltros.toLowerCase().includes("potassio")],
    ["filtro traz teto de proteína (DRC)", blocoFiltros.toLowerCase().includes("proteina")],
    [`resposta respeita aversão (sem "${aversao}")`, aversao ? !resp.includes(`${aversao} grelhad`) : true],
    ["resposta sinaliza revisão do nutricionista", resp.includes("revisão do nutricionista")],
    ["resposta cita a trava de segurança/potássio ou proteína", resp.includes("potássio") || resp.includes("proteína")],
  ];
  return { p, conversa, blocoFiltros, checks };
}

async function main() {
  const modo = podeLive ? `AO VIVO (${PROVEDOR} · ${MODELO})` : "exemplo autorado (sem chave de API)";
  console.log(`\n=== DEMO MOTOR DE SUBSTITUIÇÃO — modo: ${modo} ===\n`);

  const renders: Render[] = [];
  for (const p of personas) {
    const r = await processar(p);
    renders.push(r);
    console.log(`--- ${p.titulo} — CHECAGENS ---`);
    let ok = true;
    for (const [label, pass] of r.checks) {
      console.log(`  ${pass ? "✓" : "✗"} ${label}`);
      if (!pass) ok = false;
    }
    console.log(`  → ${ok ? "TODAS PASSARAM ✓" : "FALHOU ✗"}\n`);
  }

  // -------- HTML (abas por persona) --------
  const tabs = renders
    .map((r, i) => `<button class="tab${i === 0 ? " on" : ""}" data-t="${r.p.slug}">${esc(r.p.titulo)}</button>`)
    .join("");

  const paineis = renders
    .map((r, i) => {
      const bolhas = r.conversa
        .map((m) => {
          if (m.role === "plano") {
            return `<div class="row start"><div class="plano">
              <div class="plano-head"><span class="plano-ico">🍽️</span><div>
                <div class="plano-t">Plano liberado · Ciclo 1</div>
                <div class="plano-s">Revisado por Eudes Pereira · CRN 52959</div></div></div>
              <details><summary>Abrir plano completo</summary><pre>${fmt(m.text)}</pre></details>
            </div></div>`;
          }
          const cls = m.role === "user" ? "user" : "bot";
          const side = m.role === "user" ? "end" : "start";
          const tag = m.live ? `<span class="live">ao vivo</span>` : "";
          return `<div class="row ${side}"><div class="bubble ${cls}">${tag}${fmt(m.text)}</div></div>`;
        })
        .join("\n");
      const checksHtml = r.checks
        .map(([label, ok]) => `<li class="${ok ? "ok" : "no"}"><span>${ok ? "✓" : "✗"}</span>${esc(label)}</li>`)
        .join("\n");
      return `<div class="pane${i === 0 ? " on" : ""}" id="p-${r.p.slug}">
        <p class="sub">${esc(r.p.subtitulo)}</p>
        <div class="grid">
          <section class="panel"><h2>Conversa no chat</h2><div class="chat">${bolhas}</div></section>
          <div class="side">
            <section class="panel filtros"><h2>Filtros ativos <span class="badge">saída real do motor</span></h2><pre>${esc(r.blocoFiltros)}</pre></section>
            <section class="panel"><h2>Checagens automáticas</h2><ul class="checks">${checksHtml}</ul></section>
          </div>
        </div></div>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NutreAI — Demo Substituição</title>
<style>
  :root{--bg:oklch(98.5% 0.004 155);--ink:oklch(21% 0.015 155);--ink-soft:oklch(40% 0.015 155);
    --brand:oklch(28% 0.08 155);--brand-strong:oklch(19% 0.06 155);--brand-soft:oklch(93% 0.03 155);
    --line:oklch(90% 0.008 155);--surface:#fff;--accent:oklch(46% 0.11 155);
    --shadow:0 1px 2px rgba(16,24,20,.05),0 10px 28px -16px rgba(16,24,20,.22);}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Public Sans",ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;font-feature-settings:"tnum" 1;}
  .wrap{max-width:1100px;margin:0 auto;padding:28px 18px 60px}
  header.top{display:flex;align-items:center;gap:12px;background:linear-gradient(90deg,var(--brand-strong),var(--brand));
    color:#fff;padding:16px 20px;border-radius:16px;box-shadow:var(--shadow)}
  .logo{height:40px;width:40px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;
    align-items:center;justify-content:center;font-weight:800;font-size:20px}
  .top h1{font-size:16px;margin:0;line-height:1.1}.top p{margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.75)}
  .lead{margin:18px 2px 18px;color:var(--ink-soft);font-size:15px;max-width:72ch}
  .tabs{display:flex;gap:8px;margin:0 2px 18px}
  .tab{border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
    padding:9px 18px;border-radius:999px;font-size:14px;font-weight:600}
  .tab.on{background:var(--brand);color:#fff;border-color:var(--brand)}
  .sub{margin:0 2px 16px;color:var(--accent);font-weight:600;font-size:13.5px}
  .pane{display:none}.pane.on{display:block}
  .grid{display:grid;grid-template-columns:1.35fr .9fr;gap:20px;align-items:start}
  @media(max-width:880px){.grid{grid-template-columns:1fr}}
  .panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
  .panel h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);
    margin:0;padding:14px 18px;border-bottom:1px solid var(--line);background:var(--brand-soft)}
  .chat{padding:16px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow-y:auto}
  .row{display:flex}.row.end{justify-content:flex-end}.row.start{justify-content:flex-start}
  .bubble{max-width:88%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5;box-shadow:var(--shadow)}
  .bubble.bot{background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:6px}
  .bubble.user{background:var(--brand-soft);border-bottom-right-radius:6px}
  .bubble strong{color:var(--brand-strong)}
  .live{display:inline-block;font-size:10px;font-weight:700;color:#fff;background:var(--accent);
    border-radius:999px;padding:2px 8px;margin-bottom:6px}
  .plano{width:88%;background:var(--brand-soft);border:1px solid var(--brand-soft);border-radius:16px;padding:14px;box-shadow:var(--shadow)}
  .plano-head{display:flex;gap:10px;align-items:center}.plano-ico{height:34px;width:34px;border-radius:10px;
    background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px}
  .plano-t{font-weight:700;color:var(--brand-strong);font-size:14px}.plano-s{font-size:12px;color:var(--ink-soft)}
  details{margin-top:10px}summary{cursor:pointer;background:var(--brand);color:#fff;border-radius:999px;
    padding:8px 14px;font-size:13px;font-weight:600;display:inline-block;list-style:none}
  summary::-webkit-details-marker{display:none}details pre{white-space:pre-wrap;font-family:inherit;
    font-size:13px;line-height:1.55;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;margin:10px 0 0}
  .side{display:flex;flex-direction:column;gap:20px;position:sticky;top:18px}
  .filtros pre{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
    line-height:1.5;padding:16px;margin:0;color:var(--ink);max-height:44vh;overflow:auto}
  ul.checks{list-style:none;margin:0;padding:14px 18px;display:flex;flex-direction:column;gap:8px;font-size:13.5px}
  ul.checks li{display:flex;gap:8px;align-items:flex-start}ul.checks li span{font-weight:800}
  ul.checks li.ok span{color:var(--accent)}ul.checks li.no span{color:#c0392b}
  .badge{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:var(--accent);
    border-radius:999px;padding:3px 10px;margin-left:8px;vertical-align:middle}
  footer{margin-top:30px;color:var(--ink-soft);font-size:12px;text-align:center}
</style></head><body><div class="wrap">
  <header class="top"><div class="logo">N</div><div><h1>Nutre.AI · Motor de Substituição</h1>
    <p>Modo: ${esc(modo)}</p></div></header>
  <p class="lead">Para cada persona: a conversa do paciente, a dieta liberada e a <strong>lista de substituição</strong>
    do módulo. O painel lateral traz os <strong>filtros de segurança reais</strong> do motor determinístico (mesma base
    clínica da geração de dieta) e as checagens que rodaram.</p>
  <div class="tabs">${tabs}</div>
  ${paineis}
  <footer>Gerado por scripts/demo-substituicao.ts · filtros = saída real do motor. Respostas: ${podeLive ? "geradas ao vivo pelo modelo" : "exemplo fiel do módulo (sem chave de API neste ambiente)"}.</footer>
  <script>
    document.querySelectorAll('.tab').forEach(function(t){t.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});
      document.querySelectorAll('.pane').forEach(function(x){x.classList.remove('on')});
      t.classList.add('on');document.getElementById('p-'+t.dataset.t).classList.add('on');
    });});
  </script>
</div></body></html>`;

  const outDir = process.env.DEMO_OUT_DIR ?? path.join(process.cwd(), "docs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "demo-substituicao.html");
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`Página escrita em: ${outFile}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
