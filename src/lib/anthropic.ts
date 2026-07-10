import Anthropic from "@anthropic-ai/sdk";
import { mockCreate, type ChamadaModelo, type RespostaModelo } from "./anthropic-mock";

export const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const MOCK = process.env.ANTHROPIC_MOCK === "1";

const clienteReal = MOCK ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Interface única usada pelo app. Com ANTHROPIC_MOCK=1 as respostas são
// roteirizadas em código (zero custo) — o restante do pipeline roda igual.
export const anthropic = {
  messages: {
    async create(params: ChamadaModelo): Promise<RespostaModelo> {
      if (MOCK) return mockCreate(params);
      const r = await clienteReal!.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system,
        messages: params.messages,
      });
      return { content: r.content as RespostaModelo["content"] };
    },
  },
};
