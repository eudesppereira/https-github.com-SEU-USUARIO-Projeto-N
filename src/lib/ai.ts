// Camada de IA multi-provedor do Nutre.AI.
// Ponto ÚNICO por onde toda chamada ao modelo passa (chat e geração de dieta).
// Provedor escolhido por env AI_PROVIDER: "anthropic" | "gemini" | "mock".
// - mock: respostas roteirizadas em código, sem custo (ANTHROPIC_MOCK=1 também ativa)
// - gemini: via endpoint compatível com OpenAI do Google AI Studio (free tier)
// - anthropic: SDK oficial (produção)
// A interface (ChamadaModelo -> RespostaModelo) é a mesma para todos, então
// o resto do app não sabe qual provedor está ativo.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { mockCreate, type ChamadaModelo, type RespostaModelo } from "./anthropic-mock";

export type Provedor = "anthropic" | "gemini" | "mock";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function resolverProvedor(): Provedor {
  if (process.env.ANTHROPIC_MOCK === "1" || process.env.AI_PROVIDER === "mock") return "mock";
  if (process.env.AI_PROVIDER === "gemini") return "gemini";
  return "anthropic";
}

function resolverModelo(p: Provedor): string {
  if (p === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
}

// Best-effort no carregamento (correto no servidor Next, onde o .env já está lido).
export const PROVEDOR = resolverProvedor();
export const MODELO = resolverModelo(PROVEDOR);

// Config resolvida de forma preguiçosa: garante que scripts que fazem
// process.loadEnvFile(".env") antes de chamar create() peguem as vars certas.
let cache:
  | { provedor: Provedor; modelo: string; anthropic?: Anthropic; openai?: OpenAI }
  | null = null;

function cfg() {
  if (cache) return cache;
  const provedor = resolverProvedor();
  const modelo = resolverModelo(provedor);
  cache = { provedor, modelo };
  if (provedor === "anthropic") {
    cache.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  } else if (provedor === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não definido (AI_PROVIDER=gemini).");
    cache.openai = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return cache;
}

// Retentativa em erros transitórios (429 quota / 503 sobrecarga), comuns no
// free tier do Gemini. Backoff exponencial: ~1s, 2s, 4s.
async function comRetry<T>(fn: () => Promise<T>, tentativas = 4): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status !== 429 && status !== 503) throw e;
      ultimo = e;
      if (i < tentativas - 1) {
        const espera = 1000 * Math.pow(2, i);
        console.warn(`[nutre] modelo ocupado (${status}); retry em ${espera}ms...`);
        await new Promise((r) => setTimeout(r, espera));
      }
    }
  }
  throw ultimo;
}

export const ai = {
  messages: {
    async create(params: ChamadaModelo): Promise<RespostaModelo> {
      const c = cfg();

      if (c.provedor === "mock") {
        return mockCreate(params);
      }

      if (c.provedor === "gemini") {
        const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [];
        if (params.system) mensagens.push({ role: "system", content: params.system });
        for (const m of params.messages) mensagens.push({ role: m.role, content: m.content });
        const r = await comRetry(() =>
          c.openai!.chat.completions.create({
            model: c.modelo,
            max_tokens: params.max_tokens,
            messages: mensagens,
          })
        );
        const texto = r.choices[0]?.message?.content ?? "";
        return { content: [{ type: "text", text: texto }] };
      }

      // anthropic
      const r = await comRetry(() =>
        c.anthropic!.messages.create({
          model: c.modelo,
          max_tokens: params.max_tokens,
          system: params.system,
          messages: params.messages,
        })
      );
      return { content: r.content as RespostaModelo["content"] };
    },
  },
};
