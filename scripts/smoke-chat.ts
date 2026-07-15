// Smoke test da camada de IA: envia uma mensagem pelo provedor ativo e imprime
// a resposta. Confirma que a chave/endpoint funcionam, sem subir o site.
// Uso: npx tsx scripts/smoke-chat.ts "Quero marcar consulta"

try {
  process.loadEnvFile(".env");
} catch {
  /* vars podem já estar no ambiente */
}

async function main() {
  // import dinâmico DEPOIS de carregar o .env, para o provedor resolver certo
  const { ai, MODELO, PROVEDOR } = await import("../src/lib/ai");

  const pergunta = process.argv[2] ?? "Olá, tudo bem?";
  console.log(`[provedor=${PROVEDOR} | modelo=${MODELO}]`);
  console.log(`> ${pergunta}\n`);

  const inicio = Date.now();
  const r = await ai.messages.create({
    model: MODELO,
    max_tokens: 512,
    system:
      "Você é o atendente virtual do consultório do nutricionista Eudes Pereira (CRN 52959). Seja cordial e responda em 2-3 frases, em português.",
    messages: [{ role: "user", content: pergunta }],
  });

  const texto = r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
  console.log(texto || "(resposta vazia)");
  console.log(`\n(${((Date.now() - inicio) / 1000).toFixed(1)}s)`);
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});

export {};
