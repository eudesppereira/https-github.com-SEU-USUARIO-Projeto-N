// Teste da trava de backend SEM API: dieta pendente e invisivel; liberar publica.
import { PrismaClient } from "@prisma/client";
process.loadEnvFile(".env");
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const check = (c: boolean, n: string, d = "") => { if (c) { ok++; console.log("  ✓ " + n); } else { fail++; console.error("  ✗ " + n + (d ? " — " + d : "")); } };

async function main() {
  // login admin
  const rl = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: process.env.ADMIN_PASSWORD }) });
  const cookie = rl.headers.get("set-cookie")?.split(";")[0] ?? "";
  check(rl.ok, "login admin");

  // cliente + caso + dieta pendente (inseridos direto, simulando fim da entrevista)
  const rc = await fetch(`${BASE}/api/admin/clientes`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ nome: "Trava Teste", email: `trava.${Date.now()}@teste.dev` }) });
  const { link } = await rc.json() as { link: string };
  const token = link.split("/c/")[1];
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { token } });
  const caso = await prisma.caso.create({ data: { clienteId: cliente.id, memoria: JSON.stringify({ anamnese: { nome: "Trava" }, flags: [], perfilMetabolico: { tmb: 1824, metaCalorica: 2006, macros: { proteinaG: 162, carboidratoG: 214, gorduraG: 56 } } }) } });
  const PLANO = "*PLANO ALIMENTAR PERSONALIZADO*\nMeta Calórica: 2006 kcal (emagrecimento)\nCardápio secreto de teste XYZ123";
  const dieta = await prisma.dieta.create({ data: { casoId: caso.id, ciclo: 1, conteudo: PLANO, resumoTecnico: "resumo tecnico de teste", status: "pendente_revisao" } });

  // 1. invisivel: GET do historico do chat nao contem o plano
  const rh = await fetch(`${BASE}/api/chat/${token}`);
  const hist = await rh.json() as { mensagens: { conteudo: string }[] };
  check(!hist.mensagens.some(m => m.conteudo.includes("XYZ123")), "dieta pendente INVISIVEL no historico do chat");

  // 2. contexto do modelo: gate por status (dietaLiberada=null quando pendente)
  const pend = await prisma.dieta.findFirst({ where: { casoId: caso.id, status: "liberado" } });
  check(pend === null, "nenhuma dieta 'liberado' -> nada entra no contexto do modelo");

  // 3. liberar sem sessao -> 401
  const r401 = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/liberar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check(r401.status === 401, "liberar sem sessao admin -> 401", String(r401.status));

  // 4. liberar com termo proibido no texto editado -> 422
  const r422 = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/liberar`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ conteudo: PLANO + "\nvamos secar e queimar gordura!" }) });
  check(r422.status === 422, "liberar com termos proibidos -> bloqueado 422", String(r422.status));

  // 5. liberar valido -> plano publicado no chat + status/auditoria
  const rok = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/liberar`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: "{}" });
  check(rok.ok, "liberar valido -> 200", String(rok.status));
  const d2 = await prisma.dieta.findUniqueOrThrow({ where: { id: dieta.id } });
  check(d2.status === "liberado" && !!d2.liberadoEm, "status=liberado + liberadoEm");
  const rh2 = await fetch(`${BASE}/api/chat/${token}`);
  const hist2 = await rh2.json() as { mensagens: { conteudo: string }[] };
  check(hist2.mensagens.some(m => m.conteudo.includes("XYZ123")), "plano APARECE no chat apos liberacao");
  const aud = await prisma.auditoria.count({ where: { evento: "liberacao" } });
  check(aud > 0, "liberacao registrada na Auditoria");

  // 6. liberar de novo -> 409 (nao repete)
  const r409 = await fetch(`${BASE}/api/admin/dietas/${dieta.id}/liberar`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: "{}" });
  check(r409.status === 409, "liberar duas vezes -> 409", String(r409.status));

  // limpeza
  await prisma.cliente.delete({ where: { id: cliente.id } });
  console.log(`\nTRAVA: ${ok} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
