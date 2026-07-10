// Aceite E2E SEM a API da Anthropic (custo zero).
// Requer o servidor rodando em modo mock:  ANTHROPIC_MOCK=1 npm run dev  (ou next start)
// Uso: npx tsx scripts/teste-aceite-mock.ts
//
// Percorre o pipeline real por fora (HTTP) com o modelo simulado:
// eventos -> handlers -> cálculos em código -> geração -> validador -> fila ->
// liberação -> publicação no chat -> check-in/retorno -> LGPD.

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* vars podem já estar no ambiente */
}

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

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
const CONTEUDO_DIETA = /PLANO ALIMENTAR PERSONALIZADO|Meta Cal[oó]rica/i;

async function loginAdmin() {
  const r = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: process.env.ADMIN_PASSWORD }),
  });
  if (!r.ok) throw new Error("login admin falhou — confira ADMIN_PASSWORD e o seed");
  cookieAdmin = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function criarCliente(nome: string): Promise<{ id: string; token: string }> {
  const r = await fetch(`${BASE}/api/admin/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieAdmin },
    body: JSON.stringify({ nome, email: `${nome.toLowerCase().replace(/\s/g, ".")}.${Date.now()}@teste.dev` }),
  });
  const d = (await r.json()) as { link?: string; erro?: string };
  if (!d.link) throw new Error(`criar cliente falhou: ${d.erro}`);
  const token = d.link.split("/c/")[1];
  const c = await prisma.cliente.findUniqueOrThrow({ where: { token } });
  return { id: c.id, token };
}

async function chat(token: string, mensagem: string): Promise<string> {
  const r = await fetch(`${BASE}/api/chat/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensagem }),
  });
  const d = (await r.json()) as { mensagens?: { conteudo: string }[]; erro?: string };
  if (d.erro) throw new Error(`chat: ${d.erro}`);
  return d.mensagens?.map((m) => m.conteudo).join("\n") ?? "";
}

const ANAMNESE_MARCOS = {
  nome: "Marcos Mock",
  idade: 35,
  sexo: "masculino",
  pesoKg: 90,
  alturaCm: 175,
  medidas: { cintura: 98, quadril: 104 },
  objetivo: "emagrecimento",
  objetivoDetalhe: "chegar a 82kg",
  pesoMetaKg: 82,
  prazo: "sem prazo rígido",
  fatorAtividade: 1.375,
  atividadeDescricao: "musculação 2x/semana",
  saude: { diagnosticos: [], medicacoes: [], cirurgias: [], suplementos: [], exames: {} },
  contextoFeminino: null,
  comportamento: { refeicoesDia: 4, cozinha: true, preferencias: ["arroz", "feijão", "frango"] },
  qualidadeVida: { sonoHoras: 7, estresse: "moderado", aguaLitrosAtual: 2 },
  treinoHorasIntensasPorDia: 0,
  flags: [],
};

const ANAMNESE_JULIANA = {
  nome: "Juliana Mock",
  idade: 28,
  sexo: "feminino",
  pesoKg: 68,
  alturaCm: 165,
  medidas: {},
  objetivo: "manutencao",
  objetivoDetalhe: "saúde na gestação",
  fatorAtividade: 1.375,
  atividadeDescricao: "caminhada 3x/semana",
  saude: { diagnosticos: [], medicacoes: [], cirurgias: [], suplementos: ["ácido fólico"], exames: {} },
  contextoFeminino: { gestante: true, amamentando: false, cicloRegular: true, menopausa: false },
  comportamento: { refeicoesDia: 5, cozinha: true },
  qualidadeVida: { sonoHoras: 8, estresse: "baixo", aguaLitrosAtual: 1.5 },
  treinoHorasIntensasPorDia: 0,
  // flags propositalmente vazio: o backend DEVE detectar gestação sozinho
  flags: [],
};

async function persona1(): Promise<{ id: string; token: string }> {
  console.log("\n— PERSONA 1 (mock): caso simples, fluxo completo até a liberação");
  const cli = await criarCliente("Marcos Mock");

  // consentimento LGPD
  await chat(cli.token, `sim, autorizo [MOCK_EVENTO:consentimento_lgpd]{"resposta":"sim"}`);
  const c1 = await prisma.cliente.findUniqueOrThrow({ where: { id: cli.id } });
  check(c1.consentimentoLgpd && !!c1.consentimentoLgpdEm, "consentimento LGPD gravado com timestamp");
  check(
    (await prisma.auditoria.count({ where: { evento: "consentimento_lgpd" } })) > 0,
    "consentimento na Auditoria"
  );

  // fim da entrevista → anamnese → cálculo → geração (mock) → validador → fila
  const resposta = await chat(
    cli.token,
    `confirmo o resumo [MOCK_EVENTO:anamnese_completa]${JSON.stringify(ANAMNESE_MARCOS)}`
  );
  check(/revisão|revisao/i.test(resposta), "cliente recebeu mensagem de 'em revisão'");

  const dieta = await prisma.dieta.findFirst({ where: { caso: { clienteId: cli.id } } });
  check(!!dieta, "dieta gerada em chamada separada");
  check(dieta?.status === "pendente_revisao", "status pendente_revisao", `status=${dieta?.status}`);
  check(!dieta?.erroValidacao, "validador aprovou a dieta do mock", dieta?.erroValidacao ?? "");

  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId: cli.id } });
  const memoria = JSON.parse(caso.memoria);
  check(memoria.perfilMetabolico?.tmb === 1824, "TMB em código = 1824", `tmb=${memoria.perfilMetabolico?.tmb}`);
  check(memoria.perfilMetabolico?.get === 2508, "GET = 2508", `get=${memoria.perfilMetabolico?.get}`);
  check(memoria.perfilMetabolico?.metaCalorica === 2006, "meta = 2006", `meta=${memoria.perfilMetabolico?.metaCalorica}`);

  const msgs = await prisma.mensagem.findMany({ where: { clienteId: cli.id } });
  check(!msgs.some((m) => CONTEUDO_DIETA.test(m.conteudo)), "dieta INVISÍVEL no chat antes da liberação");
  check(!msgs.some((m) => m.conteudo.includes("NUTRE_EVENTO")), "blocos de evento não vazam no chat");

  // liberação
  const rl = await fetch(`${BASE}/api/admin/dietas/${dieta!.id}/liberar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieAdmin },
    body: "{}",
  });
  check(rl.ok, "liberação via painel");
  const depois = await prisma.mensagem.findMany({ where: { clienteId: cli.id } });
  check(depois.some((m) => CONTEUDO_DIETA.test(m.conteudo)), "plano APARECE no chat após liberação");
  return cli;
}

async function persona2() {
  console.log("\n— PERSONA 2 (mock): gestante → flag detectado PELO BACKEND");
  const cli = await criarCliente("Juliana Mock");
  await chat(cli.token, `sim, autorizo [MOCK_EVENTO:consentimento_lgpd]{"resposta":"sim"}`);
  const resposta = await chat(
    cli.token,
    `confirmo [MOCK_EVENTO:anamnese_completa]${JSON.stringify(ANAMNESE_JULIANA)}`
  );
  check(/individualizada|24.{0,3}48/i.test(resposta), "mensagem de revisão individualizada", resposta.slice(0, 120));

  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId: cli.id } });
  const flags: string[] = JSON.parse(caso.memoria).flags ?? [];
  check(
    flags.some((f) => /gesta/i.test(f)),
    "flag de gestação detectado deterministicamente (modelo mandou flags vazio)",
    JSON.stringify(flags)
  );
  const dieta = await prisma.dieta.findFirst({ where: { casoId: caso.id } });
  check(dieta?.status === "pendente_revisao", "proposta presa na fila (alerta vermelho no painel)");
}

async function persona3(cli: { id: string; token: string }) {
  console.log("\n— PERSONA 3 (mock): check-in sem dieta nova + retorno gera ciclo 2");
  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId: cli.id } });

  // ciclo ABERTO (10 dias)
  await prisma.dieta.updateMany({
    where: { casoId: caso.id, status: "liberado" },
    data: { liberadoEm: new Date(Date.now() - 10 * 86400000) },
  });
  const dietasAntes = await prisma.dieta.count({ where: { casoId: caso.id } });

  const comp = await chat(
    cli.token,
    `check-in! [MOCK_EVENTO:checkin]{"pesoKg":88.5,"medidas":{"cintura":96},"adesao":8,"dificuldades":"fins de semana"}`
  );
  check((await prisma.checkin.count({ where: { casoId: caso.id } })) === 1, "check-in registrado");
  const ck = await prisma.checkin.findFirstOrThrow({ where: { casoId: caso.id } });
  check(!!ck.comparativo && comp.length > 0, "comparativo salvo");
  check(
    (await prisma.dieta.count({ where: { casoId: caso.id } })) === dietasAntes,
    "check-in NÃO gerou dieta nova"
  );
  const mem1 = JSON.parse((await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } })).memoria);
  check(typeof mem1.indiceProgressao === "number", "índice de progressão calculado", String(mem1.indiceProgressao));
  check(mem1.ultimoPesoKg === 88.5, "memória atualizada (último peso)", String(mem1.ultimoPesoKg));

  // retorno PRECOCE (ciclo ainda aberto) → guard deve segurar
  await chat(
    cli.token,
    `retorno! [MOCK_EVENTO:retorno]{"pesoKg":88,"medidas":{},"adesao":8,"dificuldades":"","sonoEstresse":"ok","mudancasSaude":"nenhuma"}`
  );
  check(
    (await prisma.dieta.count({ where: { casoId: caso.id } })) === dietasAntes,
    "retorno FORA do ciclo não gera dieta (guard em código)"
  );

  // ciclo FECHADO (30 dias) → retorno gera ciclo 2
  await prisma.dieta.updateMany({
    where: { casoId: caso.id, status: "liberado" },
    data: { liberadoEm: new Date(Date.now() - 30 * 86400000) },
  });
  await chat(
    cli.token,
    `retorno do mês! [MOCK_EVENTO:retorno]{"pesoKg":87,"medidas":{"cintura":95},"adesao":8,"dificuldades":"fins de semana","sonoEstresse":"bom","mudancasSaude":"nenhuma"}`
  );
  const ciclo2 = await prisma.dieta.findFirst({ where: { casoId: caso.id, ciclo: 2 } });
  check(!!ciclo2, "retorno no ciclo fechado gerou dieta do ciclo 2");
  check(ciclo2?.status === "pendente_revisao", "ciclo 2 voltou à fila de revisão");
  const msgs = await prisma.mensagem.findMany({ where: { clienteId: cli.id }, orderBy: { timestamp: "desc" }, take: 1 });
  check(!CONTEUDO_DIETA.test(msgs[0]?.conteudo ?? ""), "dieta do ciclo 2 não vazou no chat");
}

async function falhaValidacao(cli: { id: string; token: string }) {
  console.log("\n— VALIDADOR (mock): falha forçada → regenera → revisão manual anotada");
  const dieta = await prisma.dieta.findFirstOrThrow({
    where: { caso: { clienteId: cli.id }, ciclo: 2, status: "pendente_revisao" },
  });
  // instrução com MOCK_FALHAR_VALIDACAO faz o mock injetar "detox" em toda tentativa
  const r = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/devolver`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieAdmin },
    body: JSON.stringify({ instrucoes: "MOCK_FALHAR_VALIDACAO — teste de falha" }),
  });
  const d = (await r.json()) as { validacaoOk?: boolean };
  check(r.ok, "devolução processada");
  check(d.validacaoOk === false, "validador reprovou todas as tentativas");
  const nova = await prisma.dieta.findFirstOrThrow({
    where: { caso: { clienteId: cli.id }, ciclo: 2, erroValidacao: { not: null } },
  });
  check(nova.status === "pendente_revisao", "dieta reprovada fica em revisão manual (não some)");
  check(/proibid/i.test(nova.erroValidacao ?? ""), "erro anotado cita termos proibidos", nova.erroValidacao ?? "");
  check(
    (await prisma.auditoria.count({ where: { evento: "validacao_falhou" } })) > 0,
    "falha registrada na Auditoria"
  );
}

async function lgpd(cli: { id: string; token: string }) {
  console.log("\n— LGPD (mock): pedido de exclusão no chat + exclusão efetiva");
  await chat(cli.token, `quero apagar meus dados, confirmo [MOCK_EVENTO:solicitacao_exclusao]{}`);
  const c = await prisma.cliente.findUniqueOrThrow({ where: { id: cli.id } });
  check(c.status === "pausado", "cliente pausado após pedido de exclusão");
  check(
    (await prisma.auditoria.count({ where: { evento: "exclusao_solicitada" } })) > 0,
    "pedido registrado na Auditoria"
  );
  const r = await fetch(`${BASE}/api/admin/clientes/${cli.id}`, {
    method: "DELETE",
    headers: { cookie: cookieAdmin },
  });
  check(r.ok, "exclusão efetiva pelo admin");
  check(
    (await prisma.cliente.findUnique({ where: { id: cli.id } })) === null,
    "dados apagados (cascade)"
  );
  check(
    (await prisma.auditoria.count({ where: { evento: "exclusao" } })) > 0,
    "exclusão na Auditoria"
  );
}

async function main() {
  await fetch(BASE).catch(() => {
    console.error(`Servidor não responde em ${BASE} — rode com ANTHROPIC_MOCK=1 antes.`);
    process.exit(1);
  });
  // confirma modo mock: a abertura do chat não deve gastar API
  await loginAdmin();
  console.log("login admin OK (modo mock)");

  const cli = await persona1();
  await persona2();
  await persona3(cli);
  await falhaValidacao(cli);
  await lgpd(cli);

  console.log(`\nRESULTADO (mock): ${passou} passaram, ${falhou} falharam.`);
  process.exit(falhou > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
