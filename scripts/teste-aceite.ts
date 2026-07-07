// Teste de aceite E2E — simula as 3 personas contra o servidor local.
// Pré-requisitos: servidor rodando (npm run dev ou next start) e ANTHROPIC_API_KEY no .env.
// Uso: npx tsx scripts/teste-aceite.ts

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env opcional se as vars já estão no ambiente */
}

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELO_SIM = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

let passou = 0;
let falhou = 0;
function check(cond: boolean, nome: string, detalhe = "") {
  if (cond) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    console.error(`  ✗ FALHOU: ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

let cookieAdmin = "";

async function loginAdmin() {
  const r = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: process.env.ADMIN_PASSWORD }),
  });
  if (!r.ok) throw new Error("login admin falhou — confira ADMIN_PASSWORD e o seed");
  cookieAdmin = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function criarCliente(nome: string, email: string): Promise<string> {
  const r = await fetch(`${BASE}/api/admin/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieAdmin },
    body: JSON.stringify({ nome, email }),
  });
  const d = (await r.json()) as { link?: string; erro?: string };
  if (!d.link) throw new Error(`criar cliente falhou: ${d.erro}`);
  return d.link.split("/c/")[1];
}

interface Msg {
  role: "user" | "assistant";
  conteudo: string;
}

async function enviarChat(token: string, body: object): Promise<string> {
  const r = await fetch(`${BASE}/api/chat/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await r.json()) as { mensagens?: { conteudo: string }[]; erro?: string };
  if (d.erro) throw new Error(`chat: ${d.erro}`);
  return d.mensagens?.map((m) => m.conteudo).join("\n") ?? "";
}

// cliente simulado por LLM: responde às perguntas do bot conforme a persona
async function respostaSimulada(persona: string, historico: Msg[]): Promise<string> {
  const r = await anthropic.messages.create({
    model: MODELO_SIM,
    max_tokens: 400,
    system: `Você simula um PACIENTE em um chat de avaliação nutricional para um teste automatizado.
Sua persona (fatos imutáveis — use exatamente estes dados quando perguntarem):
${persona}
Regras: responda como o paciente, em português, curto e direto (1-4 linhas), respondendo TODAS as perguntas da última mensagem do nutricionista-bot. Não faça perguntas de volta, não invente condições de saúde fora da persona. Quando pedirem confirmação do resumo, confirme com "sim, está tudo correto". Quando perguntarem de consentimento, autorize com "sim, autorizo".`,
    messages: historico.map((m) => ({
      // perspectiva invertida: o bot é o "user" e o paciente é o "assistant"
      role: m.role === "assistant" ? ("user" as const) : ("assistant" as const),
      content: m.conteudo,
    })),
  });
  return r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

async function conversarAteDieta(
  token: string,
  persona: string,
  clienteId: string,
  maxTurnos = 30
): Promise<Msg[]> {
  const historico: Msg[] = [];
  const abertura = await enviarChat(token, { inicio: true });
  historico.push({ role: "assistant", conteudo: abertura });

  for (let i = 0; i < maxTurnos; i++) {
    const resposta = await respostaSimulada(persona, historico);
    historico.push({ role: "user", conteudo: resposta });
    process.stdout.write(`    turno ${i + 1}… \r`);
    const doBot = await enviarChat(token, { mensagem: resposta });
    historico.push({ role: "assistant", conteudo: doBot });

    const temDieta = await prisma.dieta.count({
      where: { caso: { clienteId } },
    });
    if (temDieta > 0) return historico;
  }
  return historico;
}

const CONTEUDO_DIETA = /PLANO ALIMENTAR PERSONALIZADO|Meta Cal[oó]rica/i;

async function persona1() {
  console.log("\n— PERSONA 1: caso simples (Marcos, 35a, 90kg, 175cm, emagrecimento)");
  const token = await criarCliente("Marcos Teste", `marcos.teste.${Date.now()}@teste.dev`);
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { token } });

  const persona = `Nome: Marcos Teste. Nascimento: 10/03/1991 (35 anos). Homem. Peso 90 kg, altura 175 cm.
Sem medidas de circunferência (não tem fita métrica). Objetivo: emagrecimento, quer chegar a 82 kg sem prazo rígido.
Nunca fez acompanhamento. Treina musculação 2x por semana, 45 min, à noite, iniciante, não treina em jejum, trabalho sentado (escritório).
Nenhum diagnóstico, nenhuma medicação, nenhuma cirurgia, nenhum suplemento, sem exames recentes.
Faz 4 refeições/dia (7h café, 12h almoço, 16h lanche, 20h jantar). Cozinha o básico, 30 min/dia. Almoça em restaurante por quilo.
Orçamento ~R$ 800/mês. Gosta de arroz, feijão, frango, ovos, banana, café. Não come fígado. Sem intolerâncias, sem desconfortos.
Álcool: cerveja 1x por semana (2 latas). Não fuma. Tem geladeira no trabalho.
Triagem: nunca teve episódios de compulsão, não alterna restrição/exagero, nunca teve diagnóstico alimentar.
Sono 7h, qualidade boa. Estresse moderado. Bebe ~2 L de água. Não quer enviar fotos.`;

  const historico = await conversarAteDieta(token, persona, cliente.id);
  console.log(`    (${historico.length} mensagens na conversa)`);

  const dieta = await prisma.dieta.findFirst({
    where: { caso: { clienteId: cliente.id } },
    orderBy: { criadoEm: "desc" },
  });
  check(!!dieta, "dieta foi gerada ao fim da entrevista");
  check(dieta?.status === "pendente_revisao", "status pendente_revisao", `status=${dieta?.status}`);
  check(!!dieta?.resumoTecnico && dieta.resumoTecnico.length > 100, "resumo técnico gerado");

  const msgs = await prisma.mensagem.findMany({ where: { clienteId: cliente.id } });
  check(
    !msgs.some((m) => CONTEUDO_DIETA.test(m.conteudo)),
    "dieta INVISÍVEL no chat antes da liberação"
  );
  const ultima = msgs.filter((m) => m.role === "assistant").at(-1);
  check(
    /revis/i.test(ultima?.conteudo ?? ""),
    "cliente recebeu mensagem de 'em revisão'",
    (ultima?.conteudo ?? "").slice(0, 120)
  );

  // memória do caso
  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId: cliente.id } });
  const memoria = JSON.parse(caso.memoria);
  check(memoria.perfilMetabolico?.tmb === 1824, "TMB calculada em código = 1824", `tmb=${memoria.perfilMetabolico?.tmb}`);
  check((memoria.flags ?? []).length === 0, "sem flags no caso simples", JSON.stringify(memoria.flags));

  // liberação no painel → aparece no chat
  if (dieta) {
    const r = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/liberar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieAdmin },
      body: JSON.stringify({}),
    });
    check(r.ok, "liberação via painel OK", String(r.status));
    const depois = await prisma.mensagem.findMany({ where: { clienteId: cliente.id } });
    check(
      depois.some((m) => CONTEUDO_DIETA.test(m.conteudo)),
      "plano APARECE no chat após liberação"
    );
    const noBanco = await prisma.dieta.findUnique({ where: { id: dieta.id } });
    check(noBanco?.status === "liberado" && !!noBanco.liberadoEm, "status liberado + liberadoEm");
    const auditoria = await prisma.auditoria.count({ where: { evento: "liberacao" } });
    check(auditoria > 0, "liberação registrada na Auditoria");
  }
  return cliente.id;
}

async function persona2() {
  console.log("\n— PERSONA 2: gestante (Juliana, 28a) → flag de revisão");
  const token = await criarCliente("Juliana Teste", `juliana.teste.${Date.now()}@teste.dev`);
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { token } });

  const persona = `Nome: Juliana Teste. Nascimento: 05/06/1998 (28 anos). Mulher. Peso 68 kg, altura 165 cm.
GESTANTE de 14 semanas (segundo trimestre). Não amamenta. Sem medidas de fita.
Objetivo: manutenção e saúde na gravidez. Sem peso-meta.
Caminha 3x por semana, 30 min, manhã, iniciante, não treina em jejum, trabalho sentado.
Sem diagnósticos além da gestação, toma ácido fólico (suplemento pré-natal), nenhuma cirurgia, sem exames em mãos.
3 refeições + 2 lanches. Cozinha, 40 min/dia. Raramente come fora. Orçamento R$ 1000. Gosta de frutas, arroz, feijão, frango. Enjoo leve de manhã. Sem intolerâncias.
Não bebe álcool, não fuma. Tem geladeira.
Triagem: sem episódios de compulsão, sem restrição/exagero, sem diagnóstico alimentar.
Sono 8h boa. Estresse baixo. Água 1,5 L. Não quer enviar fotos.`;

  const historico = await conversarAteDieta(token, persona, cliente.id, 30);
  console.log(`    (${historico.length} mensagens na conversa)`);

  const caso = await prisma.caso.findFirst({ where: { clienteId: cliente.id } });
  const memoria = caso ? JSON.parse(caso.memoria) : {};
  const flags: string[] = memoria.flags ?? [];
  check(
    flags.some((f) => /gesta/i.test(f)),
    "flag de gestação ativo no caso (alerta vermelho no painel)",
    JSON.stringify(flags)
  );

  const msgs = await prisma.mensagem.findMany({ where: { clienteId: cliente.id } });
  const ultima = msgs.filter((m) => m.role === "assistant").at(-1);
  check(
    /individualizada|pessoalmente|24.{0,3}48/i.test(ultima?.conteudo ?? ""),
    "mensagem de revisão INDIVIDUALIZADA ao cliente",
    (ultima?.conteudo ?? "").slice(0, 160)
  );
  check(!msgs.some((m) => CONTEUDO_DIETA.test(m.conteudo)), "nenhuma dieta vazou no chat");

  const dieta = await prisma.dieta.findFirst({
    where: { caso: { clienteId: cliente.id } },
  });
  check(dieta?.status === "pendente_revisao", "proposta presa em pendente_revisao", `status=${dieta?.status}`);
}

async function persona3(clienteId: string) {
  console.log("\n— PERSONA 3: check-in (sem dieta nova) + retorno mensal (nova dieta na fila)");
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId } });

  // fase 1: ciclo ABERTO (liberada há 10 dias) → check-in não gera dieta
  await prisma.dieta.updateMany({
    where: { casoId: caso.id, status: "liberado" },
    data: { liberadoEm: new Date(Date.now() - 10 * 86400000) },
  });
  const dietasAntes = await prisma.dieta.count({ where: { casoId: caso.id } });

  const personaCheckin = `Nome: Marcos Teste (mesmo paciente da avaliação). Está no meio do primeiro ciclo do plano.
Peso hoje: 88,5 kg (era 90). Sem fita métrica (sem medidas novas). Adesão nota 8. Dificuldade: jantar fora no fim de semana. Sem pedidos de mudança. Não envia fotos.`;

  let historico: Msg[] = [
    {
      role: "user",
      conteudo:
        "Oi! Passando pro meu check-in da semana 2: meu peso hoje deu 88,5 kg. Sinto que segui bem o plano, nota 8. Só tive dificuldade nos jantares de fim de semana.",
    },
  ];
  let doBot = await enviarChat(cliente.token, { mensagem: historico[0].conteudo });
  historico.push({ role: "assistant", conteudo: doBot });
  // dá até 3 turnos para o bot coletar o que falta e registrar o check-in
  for (let i = 0; i < 3; i++) {
    const registrou = await prisma.checkin.count({ where: { casoId: caso.id } });
    if (registrou > 0) break;
    const resp = await respostaSimulada(personaCheckin, historico);
    historico.push({ role: "user", conteudo: resp });
    doBot = await enviarChat(cliente.token, { mensagem: resp });
    historico.push({ role: "assistant", conteudo: doBot });
  }

  const checkins = await prisma.checkin.count({ where: { casoId: caso.id } });
  check(checkins > 0, "check-in registrado no banco");
  const ultimoCheckin = await prisma.checkin.findFirst({
    where: { casoId: caso.id },
    orderBy: { data: "desc" },
  });
  check(!!ultimoCheckin?.comparativo, "comparativo gerado e salvo");
  check(
    (await prisma.dieta.count({ where: { casoId: caso.id } })) === dietasAntes,
    "check-in NÃO gerou dieta nova"
  );
  const casoDepois = await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } });
  const memDepois = JSON.parse(casoDepois.memoria);
  check(
    typeof memDepois.indiceProgressao === "number",
    "índice de progressão atualizado",
    String(memDepois.indiceProgressao)
  );

  // fase 2: ciclo FECHADO (liberada há 30 dias) → retorno gera dieta ciclo 2
  await prisma.dieta.updateMany({
    where: { casoId: caso.id, status: "liberado" },
    data: { liberadoEm: new Date(Date.now() - 30 * 86400000) },
  });

  const personaRetorno = `Nome: Marcos Teste (mesmo paciente). Fechou o primeiro mês do plano e quer o retorno mensal.
Peso hoje: 87 kg (começou com 90). Sem fita métrica (sem medidas). Adesão do mês: nota 8. Dificuldade: fins de semana.
Sono 7h bom, estresse moderado. Nenhuma mudança de saúde ou medicação. Sem pedidos de mudança na dieta. Não envia fotos.`;

  historico = [
    {
      role: "user",
      conteudo:
        "Fechei meu primeiro mês! Quero fazer o retorno: meu peso hoje é 87 kg. Adesão do mês foi nota 8, a maior dificuldade continuou sendo o fim de semana. Sono e saúde iguais, sem mudanças.",
    },
  ];
  doBot = await enviarChat(cliente.token, { mensagem: historico[0].conteudo });
  historico.push({ role: "assistant", conteudo: doBot });
  for (let i = 0; i < 4; i++) {
    const nova = await prisma.dieta.count({ where: { casoId: caso.id, ciclo: { gt: 1 } } });
    if (nova > 0) break;
    const resp = await respostaSimulada(personaRetorno, historico);
    historico.push({ role: "user", conteudo: resp });
    doBot = await enviarChat(cliente.token, { mensagem: resp });
    historico.push({ role: "assistant", conteudo: doBot });
  }

  const dietaCiclo2 = await prisma.dieta.findFirst({
    where: { casoId: caso.id, ciclo: { gt: 1 } },
    orderBy: { criadoEm: "desc" },
  });
  check(!!dietaCiclo2, "retorno mensal gerou dieta do ciclo 2");
  check(
    dietaCiclo2?.status === "pendente_revisao",
    "nova dieta voltou à fila de revisão",
    `status=${dietaCiclo2?.status}`
  );
  const msgs = await prisma.mensagem.findMany({ where: { clienteId } });
  const aposRetorno = msgs.filter((m) => m.role === "assistant").at(-1);
  check(
    !CONTEUDO_DIETA.test(aposRetorno?.conteudo ?? ""),
    "dieta do ciclo 2 NÃO vazou no chat"
  );
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY ausente — defina no .env antes de rodar o aceite.");
    process.exit(1);
  }
  // servidor no ar?
  await fetch(BASE).catch(() => {
    console.error(`Servidor não responde em ${BASE} — rode npm run dev antes.`);
    process.exit(1);
  });

  await loginAdmin();
  console.log("login admin OK");

  const clienteId = await persona1();
  await persona2();
  await persona3(clienteId);

  console.log(`\nRESULTADO: ${passou} passaram, ${falhou} falharam.`);
  process.exit(falhou > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
