// Compatibilidade: a lógica de IA vive em ./ai (multi-provedor).
// Mantido para não quebrar imports existentes; `anthropic` é o cliente
// agnóstico de provedor (Anthropic, Gemini ou mock conforme AI_PROVIDER).
export { ai as anthropic, ai, MODELO, PROVEDOR } from "./ai";
