// Geração da dieta em chamada separada (nunca no chat do cliente) + validação.
// Fluxo: cálculo em código → prompt de geração → validador → pendente_revisao.

import fs from "fs";
import path from "path";
import type { Caso, Cliente, Dieta } from "@prisma/client";
import { prisma } from "./db";
import { anthropic, MODELO } from "./anthropic";
import { auditar } from "./audit";
import { promptBase } from "./prompt";
import { lerMemoria, type MemoriaCaso } from "./caso";
import { validarDieta } from "./validador";
import type { PerfilMetabolico } from "./calculos";

const MAX_REGENERACOES = 2;

let geracaoCache: string | null = null;
function promptGeracao(): string {
  if (!geracaoCache) {
    geracaoCache = fs.readFileSync(
      path.join(process.cwd(), "prompts", "nutre-ai-geracao-dieta.md"),
      "utf8"
    );
  }
  return geracaoCache;
}

interface ParametrosGeracao {
  caso: Caso;
  cliente: Cliente;
  ciclo: number;
  // contexto extra: instruções do nutricionista (devolução) ou dados do retorno mensal
  instrucoesExtra?: string;
}

function montarContextoCaso(memoria: MemoriaCaso, cliente: Cliente, ciclo: number): string {
  const perfil = memoria.perfilMetabolico;
  return [
    "## DADOS DO CASO (fonte da verdade — use exatamente estes números)",
    "",
    `Ciclo: ${ciclo} (${ciclo === 1 ? "primeira dieta" : "retorno mensal"})`,
    `Data de hoje: ${new Date().toLocaleDateString("pt-BR")}`,
    `Nome do paciente: ${cliente.nome}`,
    "",
    "### Anamnese",
    "```json",
    JSON.stringify(memoria.anamnese ?? {}, null, 2),
    "```",
    "",
    "### Cálculos executados pelo sistema (OBRIGATÓRIO usar exatamente)",
    "```json",
    JSON.stringify(perfil ?? {}, null, 2),
    "```",
    "",
    memoria.flags && memoria.flags.length > 0
      ? `### ⚠ FLAGS DE REVISÃO ATIVOS\n${memoria.flags.map((f) => `- ${f}`).join("\n")}\nDestaque-os no topo do resumo técnico.`
      : "Nenhum flag de revisão ativo.",
    "",
    memoria.ultimoPesoKg || memoria.historicoIndice?.length
      ? `### Evolução registrada\n\`\`\`json\n${JSON.stringify(
          {
            pesoBaselineKg: memoria.pesoBaselineKg,
            medidasBaseline: memoria.medidasBaseline,
            ultimoPesoKg: memoria.ultimoPesoKg,
            ultimasMedidas: memoria.ultimasMedidas,
            indiceProgressao: memoria.indiceProgressao,
            historicoIndice: memoria.historicoIndice,
            pedidosDeMudanca: memoria.pedidosDeMudanca,
          },
          null,
          2
        )}\n\`\`\``
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function parsearSaida(texto: string): { resumoTecnico: string; dieta: string } | null {
  const m = texto.match(
    /===RESUMO_TECNICO===\s*([\s\S]*?)\s*===DIETA===\s*([\s\S]*?)\s*(?:===FIM===|$)/
  );
  if (!m) return null;
  const resumoTecnico = m[1].trim();
  const dieta = m[2].trim();
  if (!resumoTecnico || !dieta) return null;
  return { resumoTecnico, dieta };
}

export interface ResultadoGeracao {
  dieta: Dieta;
  validacaoOk: boolean;
  erros: string[];
  avisos: string[];
}

export async function gerarDietaParaRevisao(
  params: ParametrosGeracao
): Promise<ResultadoGeracao> {
  const { caso, cliente, ciclo, instrucoesExtra } = params;
  const memoria = lerMemoria(caso.memoria);
  const perfil = memoria.perfilMetabolico as PerfilMetabolico | undefined;
  if (!perfil) throw new Error("Caso sem perfil metabólico calculado.");

  const anamnese = (memoria.anamnese ?? {}) as Record<string, unknown>;
  const sexo = anamnese.sexo === "feminino" ? "feminino" : "masculino";

  const system =
    promptBase() +
    "\n\n---\n\n" +
    promptGeracao() +
    "\n\n---\n\n" +
    montarContextoCaso(memoria, cliente, ciclo) +
    (instrucoesExtra
      ? `\n\n## INSTRUÇÕES ADICIONAIS DO NUTRICIONISTA (aplicar obrigatoriamente)\n${instrucoesExtra}`
      : "");

  let ultimoErro: string[] = [];
  let ultimaSaida: { resumoTecnico: string; dieta: string } | null = null;
  let ultimosAvisos: string[] = [];

  for (let tentativa = 0; tentativa <= MAX_REGENERACOES; tentativa++) {
    const feedback =
      tentativa === 0
        ? ""
        : `\n\nA tentativa anterior FALHOU na validação automática pelos motivos abaixo. Corrija TODOS e gere novamente:\n${ultimoErro.map((e) => `- ${e}`).join("\n")}`;

    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Gere o resumo técnico e a dieta proposta do ciclo ${ciclo} no formato exato definido.${feedback}`,
        },
      ],
    });

    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");

    const saida = parsearSaida(texto);
    if (!saida) {
      ultimoErro = ["Saída fora do formato ===RESUMO_TECNICO=== / ===DIETA=== / ===FIM==="];
      continue;
    }
    ultimaSaida = saida;

    const validacao = validarDieta({
      tmb: perfil.tmb,
      metaCalorica: perfil.metaCalorica,
      macros: perfil.macros,
      textoDieta: saida.dieta,
      sexo,
    });
    ultimosAvisos = validacao.avisos;

    if (validacao.ok) {
      const dieta = await prisma.dieta.create({
        data: {
          casoId: caso.id,
          ciclo,
          conteudo: saida.dieta,
          resumoTecnico: saida.resumoTecnico,
          status: "pendente_revisao",
        },
      });
      await auditar("dieta_gerada", {
        dietaId: dieta.id,
        casoId: caso.id,
        clienteId: cliente.id,
        ciclo,
        tentativas: tentativa + 1,
        flags: memoria.flags ?? [],
        avisos: validacao.avisos,
      });
      return { dieta, validacaoOk: true, erros: [], avisos: validacao.avisos };
    }
    ultimoErro = validacao.erros;
  }

  // Esgotou tentativas → revisão manual com erro anotado (nunca chega ao cliente sem liberação)
  const dieta = await prisma.dieta.create({
    data: {
      casoId: caso.id,
      ciclo,
      conteudo: ultimaSaida?.dieta ?? "[GERAÇÃO FALHOU — elabore o plano manualmente]",
      resumoTecnico: ultimaSaida?.resumoTecnico ?? "[GERAÇÃO FALHOU]",
      status: "pendente_revisao",
      erroValidacao: ultimoErro.join(" | "),
    },
  });
  await auditar("validacao_falhou", {
    dietaId: dieta.id,
    casoId: caso.id,
    clienteId: cliente.id,
    ciclo,
    erros: ultimoErro,
  });
  return { dieta, validacaoOk: false, erros: ultimoErro, avisos: ultimosAvisos };
}
