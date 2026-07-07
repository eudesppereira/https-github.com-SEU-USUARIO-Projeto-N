import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
