// Semeia os 2 personagens clínicos (motor de conduta) como clientes reais:
// anamnese completa + conversa no chat + dieta em pendente_revisao no painel do
// nutricionista. Usa as dietas geradas pelo motor (com relatório de conflitos).
// Idempotente: apaga e recria os casos "@caso.nutre".
// Uso: npx tsx scripts/seed-casos-clinicos.ts

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* ok */
}

const prisma = new PrismaClient();
const BASE = process.env.APP_URL ?? "http://localhost:3000";

// ---------------- CASO 1 — João: DRC estágio 4 + hipertrofia ----------------
const RESUMO_JOAO = `⚠ FLAGS DE REVISÃO: Doença Renal Crônica (DRC) estágio 4 (TFG 22 mL/min).

DADOS-CHAVE
João Ribeiro, 38 anos, masculino, 82 kg, 178 cm — IMC 25,9 (sobrepeso).
Objetivo: ganho de massa muscular (musculação 4x/semana).
Exames: TFG 22 mL/min · Potássio 5,1 · Creatinina 3,1.

CÁLCULOS DO SISTEMA
TMB 1810 | GET 2806 | Meta 3150 kcal (ganho) | P 148g (1,8 g/kg) C 394g G 88g | Água 2,9L.

RELATÓRIO DE CONFLITOS
[BLOQUEIO] Nutriente: Proteína | Venceu: DRC (estágio 4) | Ajustada: hipertrofia | Valor aplicado: 65g (~0,8 g/kg) | Valor desejado: 148g | Justificativa: TFG 22 mL/min exige restrição proteica severa para retardar a progressão renal; ganho de massa com proteína alta é inviável sob risco de uremia. | Ação sugerida: acompanhar ureia/creatinina; informar o paciente que a hipertrofia fica limitada pela função renal; considerar acompanhamento nefrológico.

NOTA AO PACIENTE
João, por causa da sua condição renal, priorizamos controle estrito de proteína e fósforo para proteger seus rins. A proteína ficou abaixo de um plano padrão de ganho de massa; o foco é caloria de qualidade para não perder peso, sem sobrecarregar o organismo.

CONDUTA: aplicar teto renal de proteína (alto valor biológico), controlar potássio/fósforo, energia suficiente para evitar catabolismo. Validar antes de liberar.`;

const DIETA_JOAO = `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: João Ribeiro | Data: ${new Date().toLocaleDateString("pt-BR")}

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1810 kcal

Gasto Total Estimado: 2806 kcal

Meta Calórica: 3150 kcal (ganho controlado — proteína limitada pela função renal)

*Macros diários:*

Proteínas: 65g (limite renal ~0,8 g/kg)

Carboidratos: 430g

Gorduras: 95g

Água: 2,9 L/dia (conforme diurese)

*CARDÁPIO*

*[Café da manhã — 7h]*
- Arroz branco cozido — 2 colheres de servir (120g)
- Ovos de galinha cozidos — 2 unidades médias (100g)
Subtotal: 350 kcal | P 16g C 35g G 15g

*[Lanche da manhã — 10h]*
- Banana prata — 2 unidades médias (200g)
- Mel — 1 colher de sopa (20g)
Subtotal: 260 kcal | P 2g C 60g G 0g

*[Almoço — 12h30]*
- Arroz branco cozido — 4 colheres de servir (240g)
- Feijão carioca cozido — 1 concha média (100g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Cenoura cozida — 3 colheres de sopa (60g)
- Azeite de oliva extra virgem — 1 colher de sopa (13g)
Subtotal: 820 kcal | P 28g C 110g G 25g

*[Lanche da tarde — 16h]*
- Batata-doce cozida — 2 unidades médias (260g)
- Azeite de oliva extra virgem — 1 colher de sopa (13g)
Subtotal: 450 kcal | P 4g C 70g G 15g

*[Jantar — 20h]*
- Arroz branco cozido — 4 colheres de servir (240g)
- Peito de frango grelhado — 1 filé pequeno (80g)
- Batata-doce cozida — 1 unidade média (130g)
- Azeite de oliva extra virgem — 1 colher de sopa (13g)
Subtotal: 850 kcal | P 28g C 120g G 25g

*SUBSTITUIÇÕES*

Proteínas (limite 65g/dia): frango 80g = peixe branco 90g = 2 ovos

Carboidratos: arroz cozido 90g = batata-doce 130g = inhame 130g = mandioca 100g

Gorduras: azeite 1 col. sopa = manteiga 10g = abacate 50g

*ORIENTAÇÕES*

Restrição de proteínas é inegociável pela TFG 22 mL/min. Priorizar preparações cozidas e grelhadas, evitar adição de sal (usar ervas). Evitar aditivos de fósforo (refrigerante cola, embutidos, ultraprocessados). Acompanhar potássio e fósforo mensalmente. Hidratação conforme orientação médica.

⚠ *OBSERVAÇÕES CLÍNICAS*
DRC estágio 4: proteína limitada a ~0,8 g/kg mesmo com objetivo de hipertrofia (Camada 3 do motor de conflito — travar + flag). Reforçar exercício resistido para mitigar perda muscular dentro do limite seguro.

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês

Este plano tem caráter de informação e orientação nutricional. Para avaliação completa e individualizada, agende consulta presencial com o nutricionista Eudes Pereira — CRN 52959.`;

// -------------- CASO 2 — Marta: HAS + DRC estágio 3 + Losartana --------------
const RESUMO_MARTA = `DADOS-CHAVE
Marta Souza, 55 anos, feminino, 78 kg, 162 cm — IMC 29,7 (sobrepeso).
Objetivo: emagrecimento + controle pressórico e proteção renal.
Condições: Hipertensão + DRC estágio 3 + menopausa. Medicação: Losartana 50mg 2x/dia.
Exames: TFG 48 mL/min · Potássio 5,0 · PA 150/95.

CÁLCULOS DO SISTEMA
TMB 1430 | GET 1930 | Meta 1500 kcal | P 94g (1,2 g/kg — ajustado p/ DRC) C 150g G 50g | Água 2,5L.

RELATÓRIO DE CONFLITOS
[CONFLITO] Nutriente: Proteína | Venceu: DRC estágio 3 | Ajustada: emagrecimento (1,6–2,4 g/kg) | Valor aplicado: 94g (1,2 g/kg) | Valor desejado: 125g+ | Justificativa: proteção renal e controle de ureia prioritários. | Ação sugerida: monitorar TFG e ureia.
[CONFLITO] Nutriente: Potássio | Venceu: DRC estágio 3 / Losartana | Ajustada: DASH (3500–4700 mg) | Valor aplicado: ~2000 mg | Valor desejado: >3500 mg | Justificativa: risco de hipercalemia (K 5,0) com Losartana + TFG reduzida — meta DASH de potássio alto SUSPENSA. | Ação sugerida: controlar PA por sódio e peso, não por potássio; evitar alimentos muito ricos em potássio.

NOTA AO PACIENTE
Marta, ajustamos a dieta para ser mais gentil com seus rins: proteína de qualidade em porção moderada, menos sal e cuidado com alimentos muito ricos em potássio — mantendo o controle da pressão e o emagrecimento de forma segura.

CONDUTA: emagrecimento com déficit moderado, restrição de sódio (comum a HAS e DRC), teto de potássio pela DRC/Losartana, proteína controlada. Validar antes de liberar.`;

const DIETA_MARTA = `*PLANO ALIMENTAR PERSONALIZADO*

Paciente: Marta Souza | Data: ${new Date().toLocaleDateString("pt-BR")}

Elaborado por: Nutricionista Eudes Pereira — CRN 52959

*PERFIL METABÓLICO*

TMB: 1430 kcal

Gasto Total Estimado: 1930 kcal

Meta Calórica: 1500 kcal (emagrecimento — proteína e potássio ajustados pela DRC)

*Macros diários:*

Proteínas: 94g (1,2 g/kg)

Carboidratos: 150g

Gorduras: 50g

Água: 2,5 L/dia

*CARDÁPIO*

*[Café da manhã — 7h30]*
- Pão francês integral — 1 unidade (50g)
- Queijo minas frescal — 1 fatia média (30g)
- Café com leite desnatado — 1 xícara (200ml)
- Banana prata — 1 unidade pequena (70g)
Subtotal: 340 kcal | P 15g C 50g G 9g

*[Almoço — 12h30]*
- Arroz branco cozido — 3 colheres de sopa (45g)
- Feijão carioca cozido — 1 concha pequena (60g)
- Carne bovina magra patinho — 1 bife pequeno (80g)
- Salada de alface e pepino — 1 prato de sobremesa (80g)
- Azeite de oliva — 1/2 colher de sopa (6g)
Subtotal: 420 kcal | P 25g C 45g G 15g

*[Lanche da tarde — 16h30]*
- Maçã ou pera — 1 unidade média (120g)
- Iogurte natural desnatado — 1 pote (170g)
Subtotal: 210 kcal | P 10g C 35g G 3g

*[Jantar — 19h30]*
- Arroz branco cozido — 2 colheres de sopa (30g)
- Carne bovina magra moída — 1 porção pequena (100g)
- Legumes cozidos cenoura e abobrinha — 1 xícara (150g)
- Azeite de oliva — 1/2 colher de sopa (6g)
Subtotal: 400 kcal | P 35g C 25g G 18g

*SUBSTITUIÇÕES*

Proteínas (~25g P): carne magra 100g = frango desfiado 110g = 3 ovos = tofu firme 180g

Carboidratos (~25g C): arroz 75g = batata cozida 100g = macarrão cozido 75g = 1 fatia de pão de forma

Gorduras (~10g G): azeite 1 col. sopa = abacate 50g = 2 castanhas-do-pará

*ORIENTAÇÕES*

Temperar com alho, cebola e ervas frescas; evitar temperos prontos (caldos, shoyu) pelo sódio. Pela restrição renal, evitar ultraprocessados com aditivos de fósforo e potássio, e moderar alimentos muito ricos em potássio (banana em excesso, batata sem dessalga, água de coco). Hidratação constante conforme orientação médica.

⚠ *OBSERVAÇÕES CLÍNICAS*
DRC estágio 3 + Losartana + K 5,0: meta DASH de potássio alto suspensa; teto de potássio pela função renal (Camada 0 — trava de fármaco). Proteína controlada em 1,2 g/kg apesar do objetivo de emagrecimento.

*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês

Este plano tem caráter de informação e orientação nutricional. Para avaliação completa e individualizada, agende consulta presencial com o nutricionista Eudes Pereira — CRN 52959.`;

async function main() {
  await prisma.cliente.deleteMany({ where: { email: { endsWith: "@caso.nutre" } } });

  // ---------- João ----------
  const joao = await prisma.cliente.create({
    data: {
      nome: "João Ribeiro",
      email: "joao@caso.nutre",
      telefone: "(19) 98888-0001",
      token: "caso-joao",
      idade: 38,
      cidade: "Piracicaba/SP",
      ocupacao: "Motorista",
      rendaMensal: "2 a 3 salários",
      consentimentoLgpd: true,
      consentimentoLgpdEm: new Date(Date.now() - 2 * 86400000),
    },
  });
  const casoJoao = await prisma.caso.create({
    data: {
      clienteId: joao.id,
      memoria: JSON.stringify({
        anamnese: {
          nome: "João Ribeiro",
          idade: 38,
          sexo: "masculino",
          pesoKg: 82,
          alturaCm: 178,
          objetivo: "ganho",
          objetivoDetalhe: "Ganhar massa muscular, treina musculação 4x/semana",
          fatorAtividade: 1.55,
          saude: {
            diagnosticos: ["Doença renal crônica estágio 4 (não dialítica)"],
            medicacoes: [],
            cirurgias: [],
            suplementos: ["Whey protein 2 doses/dia"],
            exames: { tfg: "22 mL/min", potassio: "5.1", creatinina: "3.1" },
          },
          comportamento: {
            refeicoesDia: 5,
            alimentosQueGosta: ["frango", "arroz", "ovos", "batata-doce", "banana"],
            alimentosQueNaoGosta: ["jiló", "fígado"],
            refeicaoPreferida: "almoço",
            preferencias: ["frango", "arroz", "feijão"],
            restricoes: [],
          },
          recordatorio24h:
            "Café: ovos e pão. Almoço: arroz, feijão, frango, salada. Lanche: whey + banana. Jantar: frango com batata-doce.",
        },
        medidasBaseline: { cintura: 92, abdomen: 95 },
        pesoBaselineKg: 82,
        flags: ["DRC estágio 4 — restrição proteica (TFG 22)", "Potássio limítrofe (5,1)"],
        perfilMetabolico: {
          imc: 25.9,
          classificacaoImc: "sobrepeso",
          tmb: 1810,
          get: 2806,
          metaCalorica: 3150,
          macros: { proteinaG: 148, carboidratoG: 394, gorduraG: 88 },
          aguaLitros: 2.9,
          mmeKg: null,
          proteinaGPorKgBase: 1.8,
          abaixoDoPisoCalorico: false,
        },
        metaCalorica: 3150,
        macros: { proteinaG: 148, carboidratoG: 394, gorduraG: 88 },
        ultimoPesoKg: 82,
        ultimoRegistroEm: new Date().toISOString(),
      }),
    },
  });
  await prisma.dieta.create({
    data: {
      casoId: casoJoao.id,
      ciclo: 1,
      conteudo: DIETA_JOAO,
      resumoTecnico: RESUMO_JOAO,
      status: "pendente_revisao",
    },
  });
  const msgsJoao: [string, string][] = [
    ["assistant", "Olá, João! 👋 Sou o Nutre.AI, assistente do nutricionista Eudes Pereira (CRN 52959). Para montar seu plano vou coletar alguns dados de saúde. Tudo confidencial e tratado conforme a LGPD. Você autoriza? (sim/não)"],
    ["user", "Sim, autorizo."],
    ["assistant", "Show! Me conta seu nome, idade, peso e altura?"],
    ["user", "João Ribeiro, 38 anos, 82kg, 1,78m."],
    ["assistant", "Anotado! E qual seu objetivo principal com o acompanhamento?"],
    ["user", "Quero ganhar massa muscular, treino musculação 4x por semana."],
    ["assistant", "Boa, treino puxado! 💪 Antes de seguir, preciso entender seu histórico de saúde. Tem alguma condição diagnosticada ou faz uso de medicação?"],
    ["user", "Tenho doença renal crônica, estágio 4. Meu último exame deu TFG 22, potássio 5,1 e creatinina 3,1. Não tomo remédio fixo ainda, mas tomo whey 2x por dia."],
    ["assistant", "Obrigado por compartilhar, João — isso é muito importante e vou tratar com todo cuidado. 💚 A condição renal muda bastante a forma de montar seu plano, então o nutricionista Eudes vai revisar pessoalmente. Me conta como é sua alimentação num dia normal?"],
    ["user", "Café: ovos e pão. Almoço: arroz, feijão, frango e salada. Lanche: whey com banana. Janta: frango com batata-doce."],
    ["assistant", "Perfeito, deu pra entender bem sua rotina. Confirma que está tudo certo pra eu enviar pra revisão?"],
    ["user", "Confirmo!"],
    ["assistant", "Prontinho, João! Seu caso será revisado diretamente pelo nutricionista Eudes Pereira antes da liberação, porque a condição renal pede análise individualizada. Retornamos em até 24–48h. 💚"],
  ];
  for (const [role, conteudo] of msgsJoao) {
    await prisma.mensagem.create({ data: { clienteId: joao.id, role, conteudo } });
  }

  // ---------- Marta ----------
  const marta = await prisma.cliente.create({
    data: {
      nome: "Marta Souza",
      email: "marta@caso.nutre",
      telefone: "(19) 98888-0002",
      token: "caso-marta",
      idade: 55,
      cidade: "Piracicaba/SP",
      ocupacao: "Professora",
      rendaMensal: "3 a 5 salários",
      consentimentoLgpd: true,
      consentimentoLgpdEm: new Date(Date.now() - 2 * 86400000),
    },
  });
  const casoMarta = await prisma.caso.create({
    data: {
      clienteId: marta.id,
      memoria: JSON.stringify({
        anamnese: {
          nome: "Marta Souza",
          idade: 55,
          sexo: "feminino",
          pesoKg: 78,
          alturaCm: 162,
          objetivo: "emagrecimento",
          objetivoDetalhe: "Perder peso e controlar a pressão",
          fatorAtividade: 1.375,
          saude: {
            diagnosticos: ["Hipertensão arterial sistêmica", "Doença renal crônica estágio 3"],
            medicacoes: ["Losartana 50mg 2x/dia"],
            cirurgias: [],
            suplementos: [],
            exames: { tfg: "48 mL/min", potassio: "5.0", pa: "150/95" },
          },
          contextoFeminino: { menopausa: true, gestante: false, amamentando: false },
          comportamento: {
            refeicoesDia: 4,
            alimentosQueGosta: ["banana", "laranja", "feijão", "queijo", "pão"],
            alimentosQueNaoGosta: ["peixe"],
            refeicaoPreferida: "café da manhã",
            preferencias: ["frutas", "café com leite"],
            restricoes: [],
          },
          recordatorio24h:
            "Café: pão com queijo, café com leite, banana. Almoço: arroz, feijão, carne, salada. Lanche: fruta. Jantar: sopa ou o que sobrou do almoço.",
        },
        medidasBaseline: { cintura: 98, abdomen: 101 },
        pesoBaselineKg: 78,
        flags: ["DRC estágio 3 + hipertensão", "Hipercalemia limítrofe (K 5,0) com Losartana"],
        perfilMetabolico: {
          imc: 29.7,
          classificacaoImc: "sobrepeso",
          tmb: 1430,
          get: 1930,
          metaCalorica: 1500,
          macros: { proteinaG: 94, carboidratoG: 150, gorduraG: 50 },
          aguaLitros: 2.5,
          mmeKg: null,
          proteinaGPorKgBase: 1.2,
          abaixoDoPisoCalorico: false,
        },
        metaCalorica: 1500,
        macros: { proteinaG: 94, carboidratoG: 150, gorduraG: 50 },
        ultimoPesoKg: 78,
        ultimoRegistroEm: new Date().toISOString(),
      }),
    },
  });
  await prisma.dieta.create({
    data: {
      casoId: casoMarta.id,
      ciclo: 1,
      conteudo: DIETA_MARTA,
      resumoTecnico: RESUMO_MARTA,
      status: "pendente_revisao",
    },
  });
  const msgsMarta: [string, string][] = [
    ["assistant", "Olá, Marta! 👋 Sou o Nutre.AI, assistente do nutricionista Eudes Pereira (CRN 52959). Vou coletar alguns dados de saúde pra montar seu plano. Tudo confidencial e conforme a LGPD. Você autoriza? (sim/não)"],
    ["user", "Sim, autorizo."],
    ["assistant", "Ótimo! Me conta nome, idade, peso e altura?"],
    ["user", "Marta Souza, 55 anos, 78kg, 1,62m. Já estou na menopausa."],
    ["assistant", "Anotado, obrigado! 💛 E qual seu objetivo principal?"],
    ["user", "Quero emagrecer e controlar a pressão."],
    ["assistant", "Entendi. Me conta sobre sua saúde: tem alguma condição diagnosticada ou toma algum medicamento?"],
    ["user", "Tenho pressão alta e doença renal crônica estágio 3. Tomo Losartana 50mg de manhã e à noite. Último exame: TFG 48, potássio 5,0, pressão 150/95."],
    ["assistant", "Obrigado por detalhar, Marta — isso faz toda a diferença. 💛 Com pressão alta, rim e a Losartana juntos, tem alguns cuidados importantes (sal e potássio), então o nutricionista Eudes vai revisar seu plano pessoalmente. Como é sua alimentação num dia comum?"],
    ["user", "Café: pão com queijo, café com leite e banana. Almoço: arroz, feijão, carne e salada. Lanche: uma fruta. Janta: sopa ou o que sobrou do almoço."],
    ["assistant", "Perfeito! Seu café da manhã é sua refeição preferida, né? Vou manter isso no plano. Confirma que posso enviar pra revisão?"],
    ["user", "Isso, adoro meu café da manhã! Pode confirmar."],
    ["assistant", "Prontinho, Marta! Seu caso vai para revisão do nutricionista Eudes Pereira antes da liberação, porque envolve pressão + rim + medicação, que pedem análise individualizada. Retornamos em até 24–48h. 💛"],
  ];
  for (const [role, conteudo] of msgsMarta) {
    await prisma.mensagem.create({ data: { clienteId: marta.id, role, conteudo } });
  }

  console.log("Casos clínicos criados!\n");
  console.log("PAINEL DO NUTRICIONISTA (dietas em revisão):");
  console.log(`  ${BASE}/admin  (senha do .env: ADMIN_PASSWORD)`);
  console.log("\nCHAT (conversa da anamnese):");
  console.log(`  João (DRC 4 + hipertrofia):        ${BASE}/c/caso-joao`);
  console.log(`  Marta (HAS + DRC 3 + Losartana):   ${BASE}/c/caso-marta`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
