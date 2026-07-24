// Teste do motor de conduta clínica: gera 2 casos com condições que criam
// conflito entre condutas e mostra (1) as condições/interações detectadas e
// (2) a dieta + relatório de conflitos que o modelo produz.
// Uso: npx tsx scripts/teste-conduta.ts
//
// Não toca no banco — monta caso/cliente em memória e reproduz a mesma
// montagem de prompt da produção (montarSystemGeracao).

try {
  process.loadEnvFile(".env");
} catch {
  /* ok */
}

interface CasoTeste {
  titulo: string;
  cliente: Record<string, unknown>;
  memoria: Record<string, unknown>;
}

const CASOS: CasoTeste[] = [
  {
    titulo: "CASO 1 — DRC estágio 4 (não dialítica) + objetivo HIPERTROFIA",
    cliente: {
      id: "t1",
      nome: "João Ribeiro",
      idade: 38,
      cidade: "Piracicaba/SP",
      ocupacao: "Motorista",
      rendaMensal: "2 a 3 salários",
    },
    memoria: {
      pesoBaselineKg: 82,
      medidasBaseline: { cintura: 92, abdomen: 95 },
      flags: [],
      perfilMetabolico: {
        imc: 25.9,
        classificacaoImc: "sobrepeso",
        tmb: 1810,
        get: 2806,
        metaCalorica: 3150,
        macros: { proteinaG: 148, carboidratoG: 394, gorduraG: 88 },
        aguaLitros: 2.9,
        mmeKg: null,
      },
      anamnese: {
        nome: "João Ribeiro",
        idade: 38,
        sexo: "masculino",
        pesoKg: 82,
        alturaCm: 178,
        objetivo: "ganho",
        objetivoDetalhe: "Ganhar massa muscular, treina musculação 4x/semana",
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
    },
  },
  {
    titulo: "CASO 2 — Hipertensão + DRC estágio 3 + Losartana + objetivo EMAGRECIMENTO",
    cliente: {
      id: "t2",
      nome: "Marta Souza",
      idade: 55,
      cidade: "Piracicaba/SP",
      ocupacao: "Professora",
      rendaMensal: "3 a 5 salários",
    },
    memoria: {
      pesoBaselineKg: 78,
      medidasBaseline: { cintura: 98, abdomen: 101 },
      flags: [],
      perfilMetabolico: {
        imc: 29.7,
        classificacaoImc: "sobrepeso",
        tmb: 1430,
        get: 1930,
        metaCalorica: 1500,
        macros: { proteinaG: 94, carboidratoG: 150, gorduraG: 50 },
        aguaLitros: 2.5,
        mmeKg: null,
      },
      anamnese: {
        nome: "Marta Souza",
        idade: 55,
        sexo: "feminino",
        pesoKg: 78,
        alturaCm: 162,
        objetivo: "emagrecimento",
        objetivoDetalhe: "Perder peso e controlar a pressão",
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
    },
  },
];

async function main() {
  const { anthropic, MODELO, PROVEDOR } = await import("../src/lib/anthropic");
  const { montarSystemGeracao } = await import("../src/lib/dieta");
  const { detectarCondicoes } = await import("../src/lib/conduta-clinica");

  console.log(`[provedor=${PROVEDOR} | modelo=${MODELO}]\n`);

  for (const caso of CASOS) {
    console.log("\n" + "=".repeat(78));
    console.log(caso.titulo);
    console.log("=".repeat(78));

    const anamnese = caso.memoria.anamnese as Record<string, unknown>;
    const det = detectarCondicoes(anamnese);
    console.log(
      "Condições detectadas:",
      det.doencas.map((d) => `${d.nome} (sev ${d.severidade})`).join(" | ") || "nenhuma"
    );
    console.log(
      "Interações fármaco-nutriente:",
      det.interacoes.map((i) => `${i.medicamento}→${i.nutriente}`).join(" | ") || "nenhuma"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const system = montarSystemGeracao(caso.memoria as any, caso.cliente as any, 1);

    console.log("\nGerando dieta (pode levar alguns segundos)...\n");
    const resp = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: "Gere o resumo técnico e a dieta proposta do ciclo 1 no formato exato definido.",
        },
      ],
    });

    const texto = resp.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    console.log(texto);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});

export {};
