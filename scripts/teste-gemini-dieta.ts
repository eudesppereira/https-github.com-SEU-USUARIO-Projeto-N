// Teste inicial: o modelo Gemini ativo consegue GERAR a dieta no formato
// rígido e passar no validador? (parte mais difícil do fluxo — JSON/formato)
// Usa o caso de demonstração "demo-marcos". Uso: npx tsx scripts/teste-gemini-dieta.ts

try {
  process.loadEnvFile(".env");
} catch {
  /* ok */
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { gerarDietaParaRevisao } = await import("../src/lib/dieta");
  const { PROVEDOR, MODELO } = await import("../src/lib/ai");

  console.log(`[provedor=${PROVEDOR} | modelo=${MODELO}]\n`);

  const cliente = await prisma.cliente.findFirst({ where: { token: "demo-marcos" } });
  if (!cliente) {
    console.error("Rode antes: npx tsx scripts/seed-demo.ts");
    process.exit(1);
  }
  const caso = await prisma.caso.findFirstOrThrow({ where: { clienteId: cliente.id } });

  console.log("Gerando dieta com o Gemini (pode levar alguns segundos)...\n");
  const inicio = Date.now();
  const r = await gerarDietaParaRevisao({ caso, cliente, ciclo: 99 });
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`Validador: ${r.validacaoOk ? "✓ PASSOU" : "✗ FALHOU"} (${seg}s)`);
  if (r.erros.length) console.log("Erros:", r.erros.join(" | "));
  if (r.avisos.length) console.log("Avisos:", r.avisos.join(" | "));
  console.log("\n--- primeiras linhas da dieta gerada ---");
  console.log(r.dieta.conteudo.split("\n").slice(0, 22).join("\n"));
  console.log("\n--- primeiras linhas do resumo técnico ---");
  console.log(r.dieta.resumoTecnico.split("\n").slice(0, 8).join("\n"));

  // limpa a dieta de teste (ciclo 99) para não sujar a fila do painel
  await prisma.dieta.delete({ where: { id: r.dieta.id } });
  console.log("\n(dieta de teste removida da fila)");
  process.exit(r.validacaoOk ? 0 : 2);
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});

export {};
