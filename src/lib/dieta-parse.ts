// Parser tolerante do texto da dieta (formato definido em prompts/nutre-ai-geracao-dieta.md)
// pra estruturar em blocos usados no PDF. Nunca lança — se o texto fugir do
// formato esperado, os campos ficam vazios e o layout cai pro texto cru.

export interface DietaItem {
  texto: string;
  alimento: string;
  gramas: string | null;
  medidaCaseira: string | null;
}

export interface DietaRefeicao {
  titulo: string;
  itens: DietaItem[];
  subtotal: string | null;
}

export interface DietaParseada {
  perfil: [string, string][];
  refeicoes: DietaRefeicao[];
  substituicoes: string[];
  orientacoes: string | null;
  observacoesClinicas: string | null;
  acompanhamento: string | null;
  disclaimer: string | null;
  bruto: string;
}

const RE_SECAO = /^\*([A-ZÇÃÕÁÉÍÓÚ0-9 ]+)\*$/;
const RE_REFEICAO_COLCHETE = /^\*\[(.+)\]\*$/;
const RE_REFEICAO_SIMPLES = /^\*([^*]+)\*$/;
const RE_ITEM = /^-\s*(.+)$/;
// formato atual: "Alimento — medida caseira (Xg)"
const RE_ITEM_MEDIDA_GRAMAS = /^(.+?)\s*—\s*(.+?)\s*\(([\d.,]+)\s*g\)\s*$/i;
// formato legado: "Alimento — Xg (medida caseira)"
const RE_ITEM_GRAMAS_MEDIDA = /^(.+?)\s*—\s*([\d.,]+)\s*g\s*\(([^)]+)\)\s*$/i;
// fallback: "Alimento — resto" sem gramas/medida estruturados
const RE_ITEM_ALIMENTO_RESTO = /^(.+?)\s*—\s*(.+)$/;
const RE_SUBTOTAL = /^Subtotal:/i;
const RE_CHAVE_VALOR = /^([^:]{2,40}):\s*(.+)$/;

// Seções são comparadas sem acento/maiúsculas — "*CARDÁPIO*" e "*Cardapio*"
// caem no mesmo bucket "CARDAPIO", evitando bugs de comparação por causa de
// acentuação inconsistente vinda do modelo.
function normalizarSecao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function parsearItem(texto: string): DietaItem {
  const medidaGramas = texto.match(RE_ITEM_MEDIDA_GRAMAS);
  if (medidaGramas) {
    return {
      texto,
      alimento: medidaGramas[1].trim(),
      medidaCaseira: medidaGramas[2].trim(),
      gramas: `${medidaGramas[3]}g`,
    };
  }
  const gramasMedida = texto.match(RE_ITEM_GRAMAS_MEDIDA);
  if (gramasMedida) {
    return {
      texto,
      alimento: gramasMedida[1].trim(),
      gramas: `${gramasMedida[2]}g`,
      medidaCaseira: gramasMedida[3].trim(),
    };
  }
  const alimentoResto = texto.match(RE_ITEM_ALIMENTO_RESTO);
  if (alimentoResto) {
    return {
      texto,
      alimento: alimentoResto[1].trim(),
      gramas: null,
      medidaCaseira: alimentoResto[2].trim(),
    };
  }
  return { texto, alimento: texto, gramas: null, medidaCaseira: null };
}

function limparLinha(linha: string): string {
  return linha.trim();
}

export function parsearDieta(textoBruto: string): DietaParseada {
  const resultado: DietaParseada = {
    perfil: [],
    refeicoes: [],
    substituicoes: [],
    orientacoes: null,
    observacoesClinicas: null,
    acompanhamento: null,
    disclaimer: null,
    bruto: textoBruto,
  };

  const linhas = textoBruto.split("\n").map(limparLinha);
  let secaoAtual: string | null = null;
  let refeicaoAtual: DietaRefeicao | null = null;
  const buffers: Record<string, string[]> = {};

  function fecharRefeicao() {
    if (refeicaoAtual) resultado.refeicoes.push(refeicaoAtual);
    refeicaoAtual = null;
  }

  for (const linha of linhas) {
    if (!linha) continue;

    const matchRefeicaoColchete = linha.match(RE_REFEICAO_COLCHETE);
    if (matchRefeicaoColchete) {
      fecharRefeicao();
      refeicaoAtual = { titulo: matchRefeicaoColchete[1].trim(), itens: [], subtotal: null };
      secaoAtual = "CARDAPIO";
      continue;
    }

    const matchSecao = linha.match(RE_SECAO);
    if (matchSecao) {
      fecharRefeicao();
      secaoAtual = normalizarSecao(matchSecao[1]);
      continue;
    }

    // título de refeição sem colchetes (formato legado, ex.: "*Café da manhã — 7h*") —
    // só entra em jogo depois que *CARDÁPIO* já foi visto, pra não confundir com
    // rótulos em bold de outras seções.
    if (secaoAtual === "CARDAPIO") {
      const matchRefeicaoSimples = linha.match(RE_REFEICAO_SIMPLES);
      if (matchRefeicaoSimples) {
        fecharRefeicao();
        refeicaoAtual = { titulo: matchRefeicaoSimples[1].trim(), itens: [], subtotal: null };
        continue;
      }
    }

    if (linha.startsWith("⚠") && /OBSERVA/i.test(linha)) {
      fecharRefeicao();
      secaoAtual = "OBSERVACOES_CLINICAS";
      continue;
    }

    const matchAcompanhamento = linha.match(/^\*ACOMPANHAMENTO\*:\s*(.+)$/i);
    if (matchAcompanhamento) {
      fecharRefeicao();
      resultado.acompanhamento = matchAcompanhamento[1].trim();
      secaoAtual = "ENCERRADO";
      continue;
    }

    if (/^Este plano tem caráter/i.test(linha)) {
      resultado.disclaimer = linha;
      secaoAtual = "ENCERRADO";
      continue;
    }

    if (secaoAtual === "CARDAPIO" && refeicaoAtual) {
      if (RE_SUBTOTAL.test(linha)) {
        refeicaoAtual.subtotal = linha.replace(RE_SUBTOTAL, "").trim();
        continue;
      }
      const matchItem = linha.match(RE_ITEM);
      if (matchItem) {
        refeicaoAtual.itens.push(parsearItem(matchItem[1].trim()));
        continue;
      }
    }

    if (secaoAtual === "PERFIL METABOLICO") {
      if (/^\*.*\*:?$/.test(linha)) continue; // rótulo em bold (ex.: "*Macros diários:*"), não é par chave/valor
      const matchChave = linha.match(RE_CHAVE_VALOR);
      if (matchChave) {
        resultado.perfil.push([matchChave[1].trim(), matchChave[2].trim()]);
        continue;
      }
    }

    if (secaoAtual === "SUBSTITUICOES") {
      resultado.substituicoes.push(linha);
      continue;
    }

    if (secaoAtual === "ORIENTACOES") {
      buffers.orientacoes = [...(buffers.orientacoes ?? []), linha];
      continue;
    }

    if (secaoAtual === "OBSERVACOES_CLINICAS") {
      buffers.observacoesClinicas = [...(buffers.observacoesClinicas ?? []), linha];
      continue;
    }
  }
  fecharRefeicao();

  resultado.orientacoes = buffers.orientacoes?.join(" ").trim() || null;
  resultado.observacoesClinicas = buffers.observacoesClinicas?.join(" ").trim() || null;

  return resultado;
}
