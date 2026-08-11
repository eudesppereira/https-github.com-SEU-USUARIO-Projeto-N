// Semeia Marta e João como pacientes com DIETA LIBERADA + a conversa de
// substituição já registrada, para visualizar o motor no PRÓPRIO app
// (chat do paciente + card do plano + painel do nutricionista).
// Idempotente: apaga e recria os clientes "@demo.nutre".
// Uso: npx tsx scripts/seed-demo-substituicao.ts

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* ok */
}

const prisma = new PrismaClient();
const BASE = process.env.APP_URL ?? "http://localhost:3000";

interface DemoPersona {
  nome: string;
  email: string;
  token: string;
  idade: number;
  sexo: string;
  anamnese: Record<string, unknown>;
  memoriaExtra: Record<string, unknown>;
  plano: string;
  conversa: [role: "assistant" | "user", texto: string][];
}

const MARTA: DemoPersona = {
  nome: "Marta Souza",
  email: "marta@demo.nutre",
  token: "demo-marta",
  idade: 55,
  sexo: "feminino",
  anamnese: {
    nome: "Marta Souza",
    idade: 55,
    sexo: "feminino",
    pesoKg: 78,
    alturaCm: 162,
    objetivo: "emagrecimento",
    saude: {
      diagnosticos: ["Hipertensão arterial sistêmica", "Doença renal crônica estágio 3"],
      medicacoes: ["Losartana 50mg 2x/dia"],
      cirurgias: [],
      suplementos: [],
      exames: { tfg: "48 mL/min", potassio: "5.0", pa: "150/95" },
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
  memoriaExtra: {
    metaCalorica: 1500,
    macros: { proteinaG: 94, carboidratoG: 150, gorduraG: 50 },
    flags: ["DRC estágio 3 + hipertensão", "Hipercalemia limítrofe (K 5,0) com Losartana"],
    alertasSubstituicao: [
      {
        refeicao: "café da manhã 7h30",
        alimentoOriginal: "banana prata 70g",
        sugerido: "maçã 1 un. pequena",
        motivo: "fruta trocada por menor potássio; paciente com DRC + Losartana (controle de potássio)",
        nivel: "C",
        confianca: "media",
        em: new Date(Date.now() - 2 * 3600000).toISOString(),
        resolvido: false,
      },
    ],
  },
  plano: `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: Marta Souza | Ciclo 1

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1430 kcal

Gasto Total Estimado: 1930 kcal

Meta Calórica: 1500 kcal (emagrecimento — proteína e potássio ajustados pela DRC)

*Macros diários:* Proteínas 94g (1,2 g/kg) · Carboidratos 150g · Gorduras 50g · Água 2,5 L/dia

*CARDÁPIO*

*Café da manhã — 7h30*
- Pão francês integral — 1 unidade (50g)
- Queijo minas frescal — 1 fatia média (30g)
- Café com leite desnatado — 1 xícara (200ml)
- Banana prata — 1 unidade pequena (70g)

*Almoço — 12h30*
- Arroz branco cozido — 3 colheres de sopa (45g)
- Feijão carioca cozido — 1 concha pequena (60g)
- Carne bovina magra (patinho) — 1 bife pequeno (80g)
- Salada de alface e pepino (80g) · Azeite 1/2 colher de sopa

*Lanche da tarde — 16h30*
- Maçã ou pera — 1 unidade média (120g)
- Iogurte natural desnatado — 1 pote (170g)

*Jantar — 19h30*
- Arroz branco cozido — 2 colheres de sopa (30g)
- Carne bovina magra moída — 1 porção pequena (100g)
- Legumes cozidos (cenoura e abobrinha) — 1 xícara (150g)

⚠ *OBSERVAÇÕES CLÍNICAS*
DRC estágio 3 + Losartana + K 5,0: meta de potássio alto suspensa; teto de potássio pela função renal. Proteína controlada em 1,2 g/kg apesar do objetivo de emagrecimento.

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês`,
  conversa: [
    ["assistant", "Olá, Marta! 👋 Seu plano foi *liberado* pelo nutricionista Eudes Pereira. Ele já está aqui embaixo. Qualquer dúvida ou troca de alimento, é só me chamar. 💛"],
    ["user", "Adorei! Mas enjoei da carne do almoço todo dia. Posso trocar por outra coisa?"],
    ["assistant", `Claro, Marta! Dá pra trocar a carne do almoço por:

🔁 *No lugar da carne, você pode usar:*

1. *Frango grelhado — 100g*
   Fica leve e combina com o arroz e o feijão.

2. *Ovos — 2 unidades*
   Rende bem e é fácil de preparar; tempere com ervas no lugar do sal.

3. *Sobrecoxa de frango sem pele — 90g*
   Mais saborosa, feita grelhada ou cozida.

Pode ir variando entre elas ao longo da semana 💚`],
    ["user", "E a banana do café? Ouvi dizer que banana faz mal pro rim."],
    ["assistant", `Você está certa em ter atenção 🙌 Dá pra variar a fruta do café por:

🔁 *No lugar da banana, você pode usar:*

1. *Maçã — 1 unidade pequena*
   Doce na medida e bem prática.

2. *Morango — 1 xícara*
   Refrescante e barato na época.

3. *Pera — 1 unidade pequena*
   Suave e fácil de comer com o café.

Já pode seguir com a maçã; vou confirmar esse ajuste com o nutricionista Eudes e, se ele orientar algo diferente, te aviso por aqui. 💛`],
  ],
};

const JOAO: DemoPersona = {
  nome: "João Ribeiro",
  email: "joao@demo.nutre",
  token: "demo-joao",
  idade: 38,
  sexo: "masculino",
  anamnese: {
    nome: "João Ribeiro",
    idade: 38,
    sexo: "masculino",
    pesoKg: 82,
    alturaCm: 178,
    objetivo: "ganho",
    saude: {
      diagnosticos: ["Doença renal crônica estágio 4 (não dialítica)"],
      medicacoes: [],
      cirurgias: [],
      suplementos: ["Whey protein 2 doses/dia"],
      exames: { tfg: "22 mL/min", potassio: "5.1", creatinina: "3.1" },
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
  memoriaExtra: {
    metaCalorica: 3150,
    macros: { proteinaG: 65, carboidratoG: 430, gorduraG: 95 },
    flags: ["DRC estágio 4 — restrição proteica (TFG 22)", "Potássio limítrofe (5,1)"],
  },
  plano: `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: João Ribeiro | Ciclo 1

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1810 kcal

Gasto Total Estimado: 2806 kcal

Meta Calórica: 3150 kcal (ganho controlado — proteína limitada pela função renal)

*Macros diários:* Proteínas 65g (limite renal ~0,8 g/kg) · Carboidratos 430g · Gorduras 95g · Água 2,9 L/dia

*CARDÁPIO*

*Café da manhã — 7h*
- Arroz branco cozido — 2 colheres de servir (120g)
- Ovos cozidos — 2 unidades (100g)

*Lanche da manhã — 10h*
- Banana prata — 2 unidades (200g) · Mel — 1 colher de sopa (20g)

*Almoço — 12h30*
- Arroz branco cozido — 4 colheres de servir (240g)
- Feijão carioca cozido — 1 concha (100g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Cenoura cozida (60g) · Azeite 1 colher de sopa

*Lanche da tarde — 16h*
- Batata-doce cozida — 2 unidades (260g) · Azeite 1 colher de sopa

*Jantar — 20h*
- Arroz branco cozido — 4 colheres de servir (240g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Batata-doce cozida — 1 unidade (130g) · Azeite 1 colher de sopa

⚠ *OBSERVAÇÕES CLÍNICAS*
DRC estágio 4 (TFG 22): proteína travada em ~0,8 g/kg MESMO com objetivo de hipertrofia (motor de conflito: travar + flag). Energia alta para não catabolizar; whey suspenso pela sobrecarga renal.

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês`,
  conversa: [
    ["assistant", "Fala, João! 💪 Seu plano foi *liberado* pelo nutricionista Eudes Pereira. Está aqui embaixo. Precisar trocar algo, me chama."],
    ["user", "Quero botar mais whey e frango pra ganhar massa. Dá pra aumentar a proteína?"],
    ["assistant", `Entendo o objetivo, João — e vou ser honesto com você porque é importante. 🙏 Seu exame mostra a função renal bem reduzida (TFG 22), e por isso a *proteína está travada em ~0,8 g/kg* (os 65g do plano). Isso é uma trava de *segurança*, não dá pra furar nem com o objetivo de hipertrofia — proteína e whey em excesso aceleram a sobrecarga renal.

O que dá pra fazer com segurança:
- *Manter a energia alta* (carbo de qualidade) pra você não perder massa — por isso a meta é 3150 kcal.
- *Priorizar proteína de alto valor biológico* nos 65g (ovo, frango em porção controlada) pra render mais.
- Treino resistido segue firme pra proteger a massa dentro do limite seguro.

⚠️ *Revisão do nutricionista*: aumento de proteína não é liberado por aqui; o Eudes acompanha ureia/creatinina e ajusta com você. O whey fica suspenso por enquanto. 💚`],
    ["user", "Beleza. E no lanche, posso trocar a batata-doce por outra coisa?"],
    ["assistant", `Boa, essa dá pra trocar tranquilo! 🍠 No lugar da batata-doce do lanche você pode usar:

🔁 *No lugar da batata-doce:*

1. *Arroz branco — 200g*
   Rende a mesma energia da tarde e cai bem.

2. *Mandioca cozida — 180g*
   Gostosa e saciante; mantenha a porção do plano.

3. *Macarrão cozido — 180g*
   Prático e barato; evite molho pronto, faça simples.

Todas seguram bem sua energia pra treinar. Vai variando 💪`],
  ],
};

async function semear(p: DemoPersona) {
  const cliente = await prisma.cliente.create({
    data: {
      nome: p.nome,
      email: p.email,
      token: p.token,
      idade: p.idade,
      cidade: "Piracicaba/SP",
      consentimentoLgpd: true,
      consentimentoLgpdEm: new Date(Date.now() - 5 * 86400000),
    },
  });
  const caso = await prisma.caso.create({
    data: {
      clienteId: cliente.id,
      memoria: JSON.stringify({ anamnese: p.anamnese, ...p.memoriaExtra, ultimoRegistroEm: new Date().toISOString() }),
    },
  });
  await prisma.dieta.create({
    data: {
      casoId: caso.id,
      ciclo: 1,
      conteudo: p.plano,
      resumoTecnico: "Demo — dieta liberada para visualização do motor de substituição.",
      status: "liberado",
      liberadoEm: new Date(Date.now() - 3 * 86400000),
    },
  });
  // 1ª mensagem = abertura + plano (mesmo padrão da liberação real: o chat
  // detecta "PLANO ALIMENTAR" e mostra o card "Abrir plano completo").
  const conversaCompleta: [role: "assistant" | "user", texto: string][] = [
    [p.conversa[0][0], p.conversa[0][1]],
    ["assistant", `Aqui está seu plano liberado 👇\n\n${p.plano}\n\nQualquer dúvida sobre o plano, é só perguntar por aqui! 💚`],
    ...p.conversa.slice(1),
  ];
  for (const [role, conteudo] of conversaCompleta) {
    await prisma.mensagem.create({ data: { clienteId: cliente.id, role, conteudo } });
  }
}

async function main() {
  await prisma.cliente.deleteMany({ where: { email: { endsWith: "@demo.nutre" } } });
  await semear(MARTA);
  await semear(JOAO);
  console.log("Demo de substituição semeada (dietas LIBERADAS + conversa).\n");
  console.log("CHAT DO PACIENTE (conversa + dieta + lista de substituição):");
  console.log(`  Marta (HAS + DRC3 + Losartana):  ${BASE}/c/demo-marta`);
  console.log(`  João  (DRC4 + hipertrofia):      ${BASE}/c/demo-joao`);
  console.log("\nPAINEL DO NUTRICIONISTA:");
  console.log(`  ${BASE}/admin  (senha do .env: ADMIN_PASSWORD)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
