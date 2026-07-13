// Popula dados de demonstração para explorar o app (design/funcionalidades).
// Tokens fixos para links previsíveis. Idempotente: apaga e recria os demos.
// Uso: npx tsx scripts/seed-demo.ts

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* ok */
}

const prisma = new PrismaClient();
const BASE = process.env.APP_URL ?? "http://localhost:3000";

const DIETA_MARCOS = `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: Marcos Demo | Data: ${new Date().toLocaleDateString("pt-BR")}

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1824 kcal

Gasto Total Estimado: 2508 kcal

Meta Calórica: 2006 kcal (emagrecimento)

Ritmo esperado: −0,5 a −0,8 kg/semana

*Macros diários:*

Proteínas: 162g (648 kcal | 32%)

Carboidratos: 214g (856 kcal | 43%)

Gorduras: 56g (504 kcal | 25%)

Água: 3,2 L/dia

*CARDÁPIO*

*Café da manhã — 7h*
- Ovos mexidos — 3 unidades
- Pão integral — 2 fatias
- Banana — 1 média
- Café sem açúcar
Subtotal: 500 kcal | P 26g C 55g G 18g

*Almoço — 12h*
- Arroz branco — 120g
- Feijão carioca — 100g
- Frango grelhado — 150g
- Salada de folhas com azeite — à vontade
Subtotal: 700 kcal | P 55g C 75g G 18g

*Lanche — 16h*
- Iogurte natural — 1 pote
- Aveia — 30g
- Mamão — 1 fatia
Subtotal: 300 kcal | P 15g C 45g G 6g

*Jantar — 20h*
- Batata-doce — 150g
- Carne magra — 120g
- Legumes refogados — 150g
Subtotal: 506 kcal | P 40g C 45g G 14g

*SUBSTITUIÇÕES*

Proteínas (~30g P): frango 130g = peixe branco 150g = 4 ovos = atum em água 120g

Carboidratos (~30g C): arroz cozido 90g = batata-doce 130g = macarrão integral 90g = 1 banana média

Gorduras (~10g G): azeite 1 col. sopa = abacate 50g = 2 castanhas-do-pará

*ORIENTAÇÕES*

Priorizar alimentos in natura, proteína distribuída ao longo do dia, fibras nas refeições principais. Feira local: aproveite as frutas da estação.

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês

Este plano tem caráter de informação e orientação nutricional. Para avaliação completa e individualizada, agende consulta presencial com o nutricionista Eudes Pereira — CRN 52959.`;

const RESUMO_ANA = `⚠ FLAGS ATIVOS: gestação (14 semanas)

DADOS-CHAVE
Ana Demo, 28 anos, feminino, 68 kg, 165 cm — IMC 25,0 (sobrepeso limítrofe)
Objetivo: manutenção e saúde na gestação | Fator de atividade: 1,375 (leve)

CÁLCULOS DO SISTEMA
TMB: 1198 kcal | GET: 1647 kcal | Meta: 1647 kcal (manutenção)
Macros: P 82g · C 214g · G 55g | Água: 2,4 L/dia

PONTOS DE ATENÇÃO CLÍNICA
- Gestante (14 semanas, 2º trimestre) — REVISÃO OBRIGATÓRIA individualizada
- Suplemento em uso: ácido fólico (pré-natal)
- Enjoo matinal leve relatado

TRIAGEM COMPORTAMENTAL: sem sinais de risco

CONDUTA PROPOSTA
Plano de manutenção com fracionamento em 5-6 refeições (enjoo matinal),
ênfase em folato, ferro e cálcio de fontes alimentares. Necessita validação
das necessidades gestacionais pelo nutricionista antes de qualquer entrega.`;

const DIETA_ANA = `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: Ana Demo | Data: ${new Date().toLocaleDateString("pt-BR")}

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1198 kcal

Gasto Total Estimado: 1647 kcal

Meta Calórica: 1647 kcal (manutenção — gestação)

*Macros diários:*

Proteínas: 82g (328 kcal | 20%)

Carboidratos: 214g (856 kcal | 52%)

Gorduras: 55g (495 kcal | 28%)

Água: 2,4 L/dia

*CARDÁPIO*

[PROPOSTA AUTOMÁTICA — caso com flag de gestação: validar necessidades
gestacionais, fracionamento e micronutrientes antes de liberar]

*Café da manhã — 7h30*
- Pão integral — 2 fatias
- Queijo minas — 2 fatias
- Mamão — 1 fatia
Subtotal: 350 kcal | P 15g C 50g G 10g

*Lanche — 10h*
- Iogurte natural + aveia 20g
Subtotal: 200 kcal | P 10g C 25g G 6g

*Almoço — 12h30*
- Arroz — 100g, feijão — 80g, frango — 120g, couve refogada
Subtotal: 550 kcal | P 35g C 65g G 14g

*Lanche — 15h30*
- Banana + castanhas (3 un)
Subtotal: 200 kcal | P 4g C 30g G 8g

*Jantar — 19h30*
- Sopa de legumes com carne desfiada + torrada integral
Subtotal: 347 kcal | P 18g C 44g G 17g

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês

Este plano tem caráter de informação e orientação nutricional. Para avaliação completa e individualizada, agende consulta presencial com o nutricionista Eudes Pereira — CRN 52959.`;

async function main() {
  // limpa demos anteriores
  await prisma.cliente.deleteMany({ where: { email: { endsWith: "@demo.nutre" } } });

  // ---------- 1. Marcos: plano liberado, check-in feito, chat completo ----------
  const marcos = await prisma.cliente.create({
    data: {
      nome: "Marcos Demo",
      email: "marcos@demo.nutre",
      telefone: "(19) 99999-0001",
      token: "demo-marcos",
      consentimentoLgpd: true,
      consentimentoLgpdEm: new Date(Date.now() - 40 * 86400000),
      consentimentoFotos: false,
    },
  });
  const casoMarcos = await prisma.caso.create({
    data: {
      clienteId: marcos.id,
      memoria: JSON.stringify({
        anamnese: {
          nome: "Marcos Demo",
          idade: 35,
          sexo: "masculino",
          pesoKg: 90,
          alturaCm: 175,
          objetivo: "emagrecimento",
          fatorAtividade: 1.375,
        },
        medidasBaseline: { cintura: 98, quadril: 104, abdomen: 101 },
        pesoBaselineKg: 90,
        flags: [],
        perfilMetabolico: {
          imc: 29.4,
          classificacaoImc: "sobrepeso",
          tmb: 1824,
          get: 2508,
          metaCalorica: 2006,
          macros: { proteinaG: 162, carboidratoG: 214, gorduraG: 56 },
          aguaLitros: 3.2,
          mmeKg: null,
          percentualGorduraEstimado: null,
          proteinaGPorKgBase: 1.8,
          abaixoDoPisoCalorico: false,
        },
        metaCalorica: 2006,
        macros: { proteinaG: 162, carboidratoG: 214, gorduraG: 56 },
        indiceProgressao: 8.2,
        historicoIndice: [{ data: new Date().toISOString(), indice: 8.2 }],
        ultimoPesoKg: 88.5,
        ultimasMedidas: { cintura: 96, quadril: 103 },
        ultimoRegistroEm: new Date(Date.now() - 3 * 86400000).toISOString(),
        pedidosDeMudanca: [],
      }),
    },
  });
  await prisma.dieta.create({
    data: {
      casoId: casoMarcos.id,
      ciclo: 1,
      conteudo: DIETA_MARCOS,
      resumoTecnico:
        "Sem flags. Marcos Demo, 35a, M, 90kg/175cm — IMC 29,4 (sobrepeso).\nTMB 1824 | GET 2508 | Meta 2006 (déficit 20%) | P 162g C 214g G 56g | Água 3,2L.\nConduta: déficit padrão, cardápio a partir da rotina relatada (4 refeições).",
      status: "liberado",
      liberadoEm: new Date(Date.now() - 12 * 86400000),
    },
  });
  await prisma.checkin.create({
    data: {
      casoId: casoMarcos.id,
      data: new Date(Date.now() - 3 * 86400000),
      peso: 88.5,
      medidas: JSON.stringify({ cintura: 96, quadril: 103 }),
      adesao: 8,
      dificuldades: "jantares de fim de semana",
      comparativo: "Peso: 90 → 88,5 kg (▼1,5 kg | −1,7%) · Cintura: 98 → 96 cm (▼2 cm)",
    },
  });
  const msgsMarcos: [string, string][] = [
    ["assistant", "Olá, Marcos! 👋 Eu sou o Nutre.AI, assistente do nutricionista Eudes Pereira (CRN 52959). Para montar seu plano, vou coletar dados de saúde (peso, medidas, histórico, exames). Essas informações são confidenciais, usadas somente para sua avaliação nutricional e tratadas conforme a LGPD. Você autoriza? (sim/não)"],
    ["user", "Sim, autorizo!"],
    ["assistant", "Perfeito! 🙌 Vamos começar.\n\n1. Qual seu nome completo?\n2. Data de nascimento?\n3. Peso atual e altura?"],
    ["user", "Marcos Demo, 10/03/1991, 90kg e 1,75m"],
    ["assistant", "Anotado! Seguindo com a entrevista... (demais etapas da anamnese aconteceram aqui)"],
    ["user", "Confirmo, está tudo certo!"],
    ["assistant", "Prontinho! Suas informações e seu plano estão em revisão com o nutricionista Eudes Pereira (CRN 52959) — essa checagem profissional garante que tudo esteja seguro e adequado pra você. Assim que liberado, você recebe aqui."],
    ["assistant", `Boa notícia, Marcos! 🎉 Seu plano foi revisado e liberado pelo nutricionista Eudes Pereira (CRN 52959). Aqui está:\n\n${DIETA_MARCOS}\n\nQualquer dúvida sobre o plano, é só perguntar por aqui! 💚`],
    ["user", "Check-in da semana 2: estou com 88,5kg! Adesão nota 8, só escorreguei nos jantares de fim de semana."],
    ["assistant", "Que evolução, Marcos! 👏\n\n*Comparativo:*\nPeso: 90 → 88,5 kg (▼1,5 kg | −1,7%)\nCintura: 98 → 96 cm (▼2 cm)\n\nRitmo saudável e sustentável — exatamente o esperado. Fim de semana faz parte: o plano prevê flexibilidade. Seguimos! 💪"],
  ];
  for (const [role, conteudo] of msgsMarcos) {
    await prisma.mensagem.create({ data: { clienteId: marcos.id, role, conteudo } });
  }

  // ---------- 2. Ana: gestante, dieta PENDENTE na fila com flag vermelho ----------
  const ana = await prisma.cliente.create({
    data: {
      nome: "Ana Demo",
      email: "ana@demo.nutre",
      telefone: "(19) 99999-0002",
      token: "demo-ana",
      consentimentoLgpd: true,
      consentimentoLgpdEm: new Date(Date.now() - 1 * 86400000),
    },
  });
  const casoAna = await prisma.caso.create({
    data: {
      clienteId: ana.id,
      memoria: JSON.stringify({
        anamnese: {
          nome: "Ana Demo",
          idade: 28,
          sexo: "feminino",
          pesoKg: 68,
          alturaCm: 165,
          objetivo: "manutencao",
          fatorAtividade: 1.375,
          contextoFeminino: { gestante: true, amamentando: false },
          saude: { suplementos: ["ácido fólico"] },
        },
        medidasBaseline: {},
        pesoBaselineKg: 68,
        flags: ["gestação (14 semanas)"],
        perfilMetabolico: {
          imc: 25,
          classificacaoImc: "sobrepeso",
          tmb: 1198,
          get: 1647,
          metaCalorica: 1647,
          macros: { proteinaG: 82, carboidratoG: 214, gorduraG: 55 },
          aguaLitros: 2.4,
          mmeKg: null,
          percentualGorduraEstimado: null,
          proteinaGPorKgBase: 1.2,
          abaixoDoPisoCalorico: false,
        },
        metaCalorica: 1647,
        macros: { proteinaG: 82, carboidratoG: 214, gorduraG: 55 },
        ultimoPesoKg: 68,
        ultimoRegistroEm: new Date().toISOString(),
      }),
    },
  });
  await prisma.dieta.create({
    data: {
      casoId: casoAna.id,
      ciclo: 1,
      conteudo: DIETA_ANA,
      resumoTecnico: RESUMO_ANA,
      status: "pendente_revisao",
    },
  });
  const msgsAna: [string, string][] = [
    ["assistant", "Olá, Ana! 👋 Eu sou o Nutre.AI, assistente do nutricionista Eudes Pereira (CRN 52959). Para montar seu plano, vou coletar dados de saúde. Essas informações são confidenciais e tratadas conforme a LGPD. Você autoriza? (sim/não)"],
    ["user", "Sim! Ah, e estou grávida de 14 semanas, tudo bem?"],
    ["assistant", "Que fase especial, Ana! 💛 Pode deixar que vamos cuidar de tudo com atenção redobrada. Segui com suas perguntas... (entrevista completa aconteceu aqui)"],
    ["user", "Confirmo, tudo certo!"],
    ["assistant", "Seu caso será revisado diretamente pelo nutricionista Eudes Pereira antes da liberação do plano, pois envolve condições que pedem análise individualizada. Retornamos em até 24–48h. 💛"],
  ];
  for (const [role, conteudo] of msgsAna) {
    await prisma.mensagem.create({ data: { clienteId: ana.id, role, conteudo } });
  }

  // ---------- 3. João: cliente novo, chat zerado (Etapa 0 ao abrir) ----------
  await prisma.cliente.create({
    data: {
      nome: "João Demo",
      email: "joao@demo.nutre",
      telefone: "(19) 99999-0003",
      token: "demo-joao",
    },
  });

  console.log("Dados de demonstração criados!\n");
  console.log("LINKS:");
  console.log(`  Painel admin:            ${BASE}/admin  (senha do .env: ADMIN_PASSWORD)`);
  console.log(`  Chat Marcos (liberado):  ${BASE}/c/demo-marcos`);
  console.log(`  Chat Ana (em revisão):   ${BASE}/c/demo-ana`);
  console.log(`  Chat João (novo, zero):  ${BASE}/c/demo-joao`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
