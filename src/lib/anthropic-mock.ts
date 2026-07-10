// Modelo simulado para testes sem a API da Anthropic (ANTHROPIC_MOCK=1).
// Cobre os dois usos do app:
//  1. Chat: responde de forma roteirizada; mensagens do usuário podem carregar
//     [MOCK_EVENTO:tipo]{json} — o mock os reemite como blocos NUTRE_EVENTO
//     reais, exercitando parser, handlers, cálculos e trava de backend.
//  2. Geração de dieta: lê os cálculos do próprio contexto e devolve um plano
//     no formato exato, com os números certos, para o validador aprovar.
//     Se as instruções contiverem MOCK_FALHAR_VALIDACAO, injeta termo proibido
//     para exercitar o caminho de falha → regeneração → revisão manual.

export interface ChamadaModelo {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface RespostaModelo {
  content: { type: "text"; text: string }[];
}

function texto(t: string): RespostaModelo {
  return { content: [{ type: "text", text: t }] };
}

// [MOCK_EVENTO:tipo]{json opcional} — um ou mais por mensagem; o JSON de cada
// segmento vai até o próximo [MOCK_EVENTO: ou o fim (suporta objetos aninhados)
function extrairMockEventos(msg: string): { tipo: string; json: string }[] {
  const partes = msg.split("[MOCK_EVENTO:").slice(1);
  const eventos: { tipo: string; json: string }[] = [];
  for (const parte of partes) {
    const fim = parte.indexOf("]");
    if (fim < 0) continue;
    eventos.push({ tipo: parte.slice(0, fim), json: parte.slice(fim + 1).trim() || "{}" });
  }
  return eventos;
}

function extrairPerfilDoContexto(system: string): {
  tmb: number;
  get: number;
  metaCalorica: number;
  macros: { proteinaG: number; carboidratoG: number; gorduraG: number };
  aguaLitros: number;
} | null {
  // procura o bloco JSON dos cálculos (contém "tmb" e "metaCalorica")
  const blocos = system.match(/```json\n([\s\S]*?)\n```/g) ?? [];
  for (const b of blocos) {
    try {
      const json = JSON.parse(b.replace(/```json\n|\n```/g, ""));
      if (json.tmb && json.metaCalorica && json.macros) return json;
    } catch {
      /* tenta o próximo bloco */
    }
  }
  return null;
}

export function mockCreate(params: ChamadaModelo): RespostaModelo {
  const system = params.system ?? "";

  // ---- modo geração de dieta ----
  if (system.includes("TAREFA — GERAÇÃO DE RESUMO TÉCNICO")) {
    const perfil = extrairPerfilDoContexto(system);
    if (!perfil) {
      return texto("===RESUMO_TECNICO===\n[MOCK] sem cálculos no contexto\n===DIETA===\nplano inválido\n===FIM===");
    }
    const falhar = system.includes("MOCK_FALHAR_VALIDACAO");
    const flags = system.includes("FLAGS DE REVISÃO ATIVOS");
    const { tmb, get, metaCalorica, macros, aguaLitros } = perfil;
    const p = macros.proteinaG;
    const c = macros.carboidratoG;
    const g = macros.gorduraG;
    const dieta = [
      "*PLANO ALIMENTAR PERSONALIZADO*",
      "",
      "Paciente: [mock] | Data: " + new Date().toLocaleDateString("pt-BR"),
      "",
      "Elaborado por: Nutricionista Eudes Pereira — CRN 52959",
      "",
      "*PERFIL METABÓLICO*",
      "",
      `TMB: ${tmb} kcal`,
      "",
      `Gasto Total Estimado: ${get} kcal`,
      "",
      `Meta Calórica: ${metaCalorica} kcal (objetivo)`,
      "",
      "*Macros diários:*",
      "",
      `Proteínas: ${p}g (${p * 4} kcal)`,
      `Carboidratos: ${c}g (${c * 4} kcal)`,
      `Gorduras: ${g}g (${g * 9} kcal)`,
      "",
      `Água: ${aguaLitros} L/dia`,
      "",
      "*CARDÁPIO*",
      "",
      "*Café da manhã — 7h*",
      "- Ovos mexidos — 3 unidades",
      "- Pão integral — 2 fatias",
      `Subtotal: ${Math.round(metaCalorica * 0.25)} kcal`,
      "",
      "*Almoço — 12h*",
      "- Arroz, feijão, frango grelhado e salada",
      `Subtotal: ${Math.round(metaCalorica * 0.35)} kcal`,
      "",
      "*Lanche — 16h*",
      "- Fruta e iogurte natural",
      `Subtotal: ${Math.round(metaCalorica * 0.15)} kcal`,
      "",
      "*Jantar — 20h*",
      "- Legumes refogados com carne magra",
      `Subtotal: ${Math.round(metaCalorica * 0.25)} kcal`,
      "",
      falhar ? "Dica: plano detox para secar rapidinho!" : "*ORIENTAÇÕES*: priorizar in natura, hidratação ao longo do dia.",
      "",
      "*ACOMPANHAMENTO*: check-in na semana 2 + nova dieta ajustada todo mês",
    ].join("\n");

    const resumo = [
      "[MOCK] RESUMO TÉCNICO — gerado pelo modelo simulado para testes.",
      flags ? "⚠ FLAGS ATIVOS — ver contexto do caso." : "Sem flags.",
      `Cálculos: TMB ${tmb} | GET ${get} | Meta ${metaCalorica} | P ${p}g C ${c}g G ${g}g | Água ${aguaLitros}L`,
      "Conduta proposta: plano padrão de teste conforme cálculos do sistema.",
    ].join("\n");

    return texto(`===RESUMO_TECNICO===\n${resumo}\n===DIETA===\n${dieta}\n===FIM===`);
  }

  // ---- modo chat ----
  const ultima = params.messages.at(-1)?.content ?? "";

  // abertura (Etapa 0)
  if (ultima.includes("[SISTEMA:")) {
    return texto(
      "Olá! 👋 Eu sou o Nutre.AI, assistente do nutricionista Eudes Pereira (CRN 52959). " +
        "Para montar seu plano, vou coletar dados de saúde (peso, medidas, histórico, exames). " +
        "Essas informações são confidenciais, usadas somente para sua avaliação nutricional e tratadas conforme a LGPD. Você autoriza? (sim/não)"
    );
  }

  // mensagens de teste com eventos embutidos
  const eventos = extrairMockEventos(ultima).map(
    (e) => `<<<NUTRE_EVENTO:${e.tipo}>>>\n${e.json}\n<<<FIM_NUTRE_EVENTO>>>`
  );
  if (eventos.length > 0) {
    const temFlag = ultima.includes('"gestante": true') || ultima.includes('"gestante":true');
    const corpo = ultima.includes("anamnese_completa")
      ? temFlag
        ? "Seu caso será revisado diretamente pelo nutricionista Eudes Pereira antes da liberação do plano, pois envolve condições que pedem análise individualizada. Retornamos em até 24–48h."
        : "Prontinho! Suas informações e seu plano estão em revisão com o nutricionista Eudes Pereira (CRN 52959). Assim que liberado, você recebe aqui."
      : ultima.includes("checkin")
        ? "Registro feito! Comparativo: peso atual vs. início — você está no caminho. 💪 (comparativo simulado)"
        : ultima.includes("retorno")
          ? "Fechamos o ciclo! Sua nova dieta está em revisão com o nutricionista. (retorno simulado)"
          : "Certo, registrado! (resposta simulada)";
    return texto(`${corpo}\n\n${eventos.join("\n")}`);
  }

  return texto("Entendido! (resposta simulada do Nutre.AI em modo de teste — ANTHROPIC_MOCK=1)");
}
