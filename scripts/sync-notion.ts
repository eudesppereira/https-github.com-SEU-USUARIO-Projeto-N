// Sincroniza a base de pacientes do Nutre.AI com um database do Notion.
//
// Uso:
//   npm run sync:notion            -> DRY-RUN (não envia nada)
//   npm run sync:notion -- --apply -> executa de verdade
//
// Requer no .env:
//   NOTION_TOKEN=secret_xxx            (nunca hardcoded, nunca commitado)
//   NOTION_PARENT_PAGE_ID=<id da pagina parent>   (opcional; default abaixo)
//
// Idempotência: usa Cliente.id como chave externa na propriedade "ID Paciente".
// Registro existente é ATUALIZADO; nunca duplicado.
//
// ATENÇÃO (LGPD): este script envia dado sensível de saúde (patologias,
// medicações, peso, medidas) para um serviço externo. Credenciais do paciente
// (token, senhaHash) e o PDF da dieta NUNCA são enviados.

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env opcional em CI */
}

const prisma = new PrismaClient();

const NOTION_TOKEN = process.env.NOTION_TOKEN ?? "";
const PARENT_PAGE_ID =
  process.env.NOTION_PARENT_PAGE_ID ?? "465f225aa896821391470147953a7b79";
const NOTION_VERSION = "2022-06-28";
const DB_TITULO = "Pacientes Nutri.AI";
const APLICAR = process.argv.includes("--apply");

// Rate limit do Notion ~3 req/s -> 1 requisição a cada ~340ms.
const INTERVALO_MS = 340;
const MAX_TENTATIVAS = 5;

// ---------------------------------------------------------------- utilidades

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let ultimaRequisicao = 0;

/** Chamada à API do Notion com rate limit + retry/backoff em 429 e 5xx. */
async function notion<T = unknown>(
  caminho: string,
  metodo: "GET" | "POST" | "PATCH",
  corpo?: unknown,
): Promise<T> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const espera = INTERVALO_MS - (Date.now() - ultimaRequisicao);
    if (espera > 0) await dormir(espera);
    ultimaRequisicao = Date.now();

    const r = await fetch(`https://api.notion.com/v1${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    if (r.ok) return (await r.json()) as T;

    // 429 (rate limit) e 5xx -> backoff exponencial e tenta de novo
    if (r.status === 429 || r.status >= 500) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const backoff =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : INTERVALO_MS * 2 ** tentativa;
      console.warn(
        `  [${r.status}] aguardando ${backoff}ms (tentativa ${tentativa}/${MAX_TENTATIVAS})`,
      );
      await dormir(backoff);
      continue;
    }

    const texto = await r.text();
    throw new Error(`Notion ${metodo} ${caminho} -> ${r.status}: ${texto}`);
  }
  throw new Error(`Notion ${metodo} ${caminho}: esgotou ${MAX_TENTATIVAS} tentativas`);
}

function lerJson(bruto: string): Record<string, unknown> {
  try {
    const v = JSON.parse(bruto);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** Normaliza para lista de strings. Notion não aceita vírgula em multi-select. */
function lista(v: unknown): string[] {
  const bruto: unknown[] = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[,;]/)
      : [];
  return bruto
    .map((x) => (typeof x === "string" ? x : (txt(x) ?? "")))
    .map((s) => s.replace(/,/g, ";").trim())
    .filter((s) => s.length > 0)
    .slice(0, 100);
}

/** Primeira chave presente entre os sinônimos. */
function pegar(fonte: Record<string, unknown>, ...chaves: string[]): unknown {
  for (const k of chaves) if (fonte[k] !== undefined) return fonte[k];
  return undefined;
}

function dataIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ------------------------------------------------------------ achatar dados

interface Registro {
  id: string;
  nome: string;
  campos: Record<string, unknown>;
}

// Chaves de `saude` já mapeadas para propriedades dedicadas — o restante vai
// para "Outras notas de saúde" em texto, para não perder informação.
const SAUDE_MAPEADAS = new Set([
  "patologias", "doencas", "doenças", "condicoes", "condições", "diagnosticos", "diagnósticos",
  "medicacoes", "medicações", "medicamentos", "remedios", "remédios",
  "suplementos", "suplementacao", "suplementação",
]);

async function montarRegistros(): Promise<Registro[]> {
  const clientes = await prisma.cliente.findMany({ orderBy: { criadoEm: "asc" } });
  const registros: Registro[] = [];

  for (const c of clientes) {
    const caso = await prisma.caso.findFirst({
      where: { clienteId: c.id },
      orderBy: { criadoEm: "desc" },
    });

    const memoria = caso ? lerJson(caso.memoria) : {};
    const anamnese = obj(memoria.anamnese);
    const perfil = obj(memoria.perfilMetabolico);
    const macros = obj(perfil.macros);
    const saude = obj(anamnese.saude);
    const medidas = { ...obj(memoria.medidasBaseline), ...obj(memoria.ultimasMedidas) };

    const dieta = caso
      ? await prisma.dieta.findFirst({ where: { casoId: caso.id }, orderBy: { ciclo: "desc" } })
      : null;
    const totalCheckins = caso
      ? await prisma.checkin.count({ where: { casoId: caso.id } })
      : 0;

    // sobras de `saude` viram texto (não perder patologia com nome inesperado)
    const sobras = Object.entries(saude)
      .filter(([k]) => !SAUDE_MAPEADAS.has(k.toLowerCase()))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : (txt(v) ?? "")}`)
      .join(" | ");

    registros.push({
      id: c.id,
      nome: c.nome,
      campos: {
        // --- cadastrais / operacionais
        "ID Paciente": c.id,
        Email: c.email,
        Telefone: c.telefone,
        Idade: c.idade ?? num(anamnese.idade),
        Cidade: c.cidade,
        "Ocupação": c.ocupacao,
        "Renda mensal": c.rendaMensal,
        Plano: c.plano,
        Status: c.status,
        "Consent. LGPD": c.consentimentoLgpd,
        "Consent. LGPD em": dataIso(c.consentimentoLgpdEm),
        "Consent. fotos": c.consentimentoFotos,
        "Consent. fotos em": dataIso(c.consentimentoFotosEm),
        "Criado em": dataIso(c.criadoEm),

        // --- clínicos: antropometria e objetivo
        Sexo: txt(anamnese.sexo),
        "Altura cm": num(anamnese.alturaCm),
        "Peso baseline kg": num(memoria.pesoBaselineKg) ?? num(anamnese.pesoKg),
        "Peso atual kg": num(memoria.ultimoPesoKg) ?? num(anamnese.pesoKg),
        "Peso meta kg": num(anamnese.pesoMetaKg),
        Objetivo: txt(anamnese.objetivo),
        Prazo: txt(anamnese.prazo),
        "Fator atividade": num(anamnese.fatorAtividade),

        // --- clínicos: perfil metabólico
        IMC: num(perfil.imc),
        "Classificação IMC": txt(perfil.classificacaoImc),
        "TMB kcal": num(perfil.tmb),
        "GET/EER kcal": num(perfil.get),
        "Meta calórica kcal": num(perfil.metaCalorica) ?? num(memoria.metaCalorica),
        "Método energia": txt(perfil.metodoEnergia),
        "Proteína g": num(macros.proteinaG),
        "Carboidrato g": num(macros.carboidratoG),
        "Gordura g": num(macros.gorduraG),
        "Água L": num(perfil.aguaLitros),

        // --- clínicos: saúde (sensível)
        Patologias: lista(
          pegar(saude, "patologias", "doencas", "doenças", "condicoes", "condições", "diagnosticos", "diagnósticos"),
        ),
        "Medicações": lista(
          pegar(saude, "medicacoes", "medicações", "medicamentos", "remedios", "remédios"),
        ),
        Suplementos: lista(pegar(saude, "suplementos", "suplementacao", "suplementação")),
        "Outras notas de saúde": sobras || null,
        Flags: lista(memoria.flags),

        // --- medidas
        "Cintura cm": num(medidas.cintura),
        "Quadril cm": num(medidas.quadril),
        "Abdômen cm": num(medidas.abdomen),

        // --- acompanhamento
        "Índice progressão": num(memoria.indiceProgressao),
        "Último registro": dataIso(memoria.ultimoRegistroEm),
        "Check-ins": totalCheckins,
        "Status do plano": dieta?.status ?? null,
        Ciclo: dieta?.ciclo ?? null,
        "Liberado em": dataIso(dieta?.liberadoEm),
      },
    });
  }
  return registros;
}

// -------------------------------------------------- schema do database Notion

type TipoProp =
  | "title" | "rich_text" | "email" | "phone_number"
  | "number" | "date" | "select" | "multi_select" | "checkbox";

// Ordem importa: é a ordem das colunas no Notion.
const SCHEMA: Array<[string, TipoProp]> = [
  ["Paciente", "title"],
  ["ID Paciente", "rich_text"],
  ["Status", "select"],
  ["Plano", "select"],
  ["Status do plano", "select"],
  ["Email", "email"],
  ["Telefone", "phone_number"],
  ["Idade", "number"],
  ["Sexo", "select"],
  ["Cidade", "select"],
  ["Ocupação", "rich_text"],
  ["Renda mensal", "select"],
  ["Altura cm", "number"],
  ["Peso baseline kg", "number"],
  ["Peso atual kg", "number"],
  ["Peso meta kg", "number"],
  ["Objetivo", "select"],
  ["Prazo", "rich_text"],
  ["Fator atividade", "number"],
  ["IMC", "number"],
  ["Classificação IMC", "select"],
  ["TMB kcal", "number"],
  ["GET/EER kcal", "number"],
  ["Meta calórica kcal", "number"],
  ["Método energia", "select"],
  ["Proteína g", "number"],
  ["Carboidrato g", "number"],
  ["Gordura g", "number"],
  ["Água L", "number"],
  ["Patologias", "multi_select"],
  ["Medicações", "multi_select"],
  ["Suplementos", "multi_select"],
  ["Outras notas de saúde", "rich_text"],
  ["Flags", "multi_select"],
  ["Cintura cm", "number"],
  ["Quadril cm", "number"],
  ["Abdômen cm", "number"],
  ["Índice progressão", "number"],
  ["Check-ins", "number"],
  ["Ciclo", "number"],
  ["Último registro", "date"],
  ["Liberado em", "date"],
  ["Consent. LGPD", "checkbox"],
  ["Consent. LGPD em", "date"],
  ["Consent. fotos", "checkbox"],
  ["Consent. fotos em", "date"],
  ["Criado em", "date"],
];

function propsDoSchema(): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [nome, tipo] of SCHEMA) {
    props[nome] =
      tipo === "title" ? { title: {} }
      : tipo === "rich_text" ? { rich_text: {} }
      : tipo === "email" ? { email: {} }
      : tipo === "phone_number" ? { phone_number: {} }
      : tipo === "number" ? { number: {} }
      : tipo === "date" ? { date: {} }
      : tipo === "select" ? { select: {} }
      : tipo === "multi_select" ? { multi_select: {} }
      : { checkbox: {} };
  }
  return props;
}

/** Converte um valor cru na forma de propriedade que a API do Notion espera. */
function valorNotion(tipo: TipoProp, valor: unknown): unknown | null {
  if (tipo === "checkbox") return { checkbox: valor === true };
  if (valor === null || valor === undefined || valor === "") return null;

  switch (tipo) {
    case "title":
      return { title: [{ text: { content: String(valor).slice(0, 2000) } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(valor).slice(0, 2000) } }] };
    case "email":
      return { email: String(valor) };
    case "phone_number":
      return { phone_number: String(valor) };
    case "number": {
      const n = Number(valor);
      return Number.isFinite(n) ? { number: n } : null;
    }
    case "date":
      return { date: { start: String(valor) } };
    case "select":
      return { select: { name: String(valor).replace(/,/g, ";").slice(0, 100) } };
    case "multi_select": {
      const itens = Array.isArray(valor) ? valor : lista(valor);
      return itens.length
        ? { multi_select: itens.map((n) => ({ name: String(n).slice(0, 100) })) }
        : null;
    }
  }
  return null;
}

function propriedadesDaPagina(reg: Registro): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [nome, tipo] of SCHEMA) {
    const valor = nome === "Paciente" ? reg.nome : reg.campos[nome];
    const v = valorNotion(tipo, valor);
    if (v !== null) props[nome] = v;
  }
  return props;
}

// ------------------------------------------------------------------ execução

interface DbBusca {
  results: Array<{ id: string; title?: Array<{ plain_text?: string }> }>;
}
interface QueryResp {
  results: Array<{ id: string }>;
}

/** Acha o database "Pacientes Nutri.AI" sob o parent, ou cria. */
async function acharOuCriarDatabase(): Promise<string> {
  const busca = await notion<DbBusca>("/search", "POST", {
    query: DB_TITULO,
    filter: { value: "database", property: "object" },
  });
  const achado = busca.results.find(
    (d) => (d.title ?? []).map((t) => t.plain_text ?? "").join("") === DB_TITULO,
  );
  if (achado) {
    console.log(`Database existente encontrado: ${achado.id}`);
    return achado.id;
  }

  const criado = await notion<{ id: string }>("/databases", "POST", {
    parent: { type: "page_id", page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: DB_TITULO } }],
    properties: propsDoSchema(),
  });
  console.log(`Database criado: ${criado.id}`);
  return criado.id;
}

/** Busca a página cujo "ID Paciente" bate com o id — chave de idempotência. */
async function acharPagina(databaseId: string, idPaciente: string): Promise<string | null> {
  const r = await notion<QueryResp>(`/databases/${databaseId}/query`, "POST", {
    filter: { property: "ID Paciente", rich_text: { equals: idPaciente } },
    page_size: 1,
  });
  return r.results[0]?.id ?? null;
}

function relatorioDryRun(registros: Registro[]): void {
  console.log(`\n=== DRY-RUN — nada foi enviado ao Notion ===`);
  console.log(`Parent page: ${PARENT_PAGE_ID}`);
  console.log(`Database:    "${DB_TITULO}"`);
  console.log(`Registros:   ${registros.length}\n`);

  console.log("COBERTURA POR CAMPO (quantos registros têm valor):");
  for (const [nome, tipo] of SCHEMA) {
    const preenchidos = registros.filter((r) => {
      const v = nome === "Paciente" ? r.nome : r.campos[nome];
      if (Array.isArray(v)) return v.length > 0;
      if (tipo === "checkbox") return v === true;
      return v !== null && v !== undefined && v !== "";
    }).length;
    const barra = "#".repeat(
      Math.round((preenchidos / Math.max(registros.length, 1)) * 20),
    );
    console.log(
      `  ${nome.padEnd(24)} ${String(preenchidos).padStart(3)}/${registros.length} ${barra}`,
    );
  }

  console.log("\nAMOSTRA (3 registros, como seriam enviados):");
  for (const reg of registros.slice(0, 3)) {
    console.log(`\n--- ${reg.nome} (${reg.id})`);
    for (const [nome] of SCHEMA) {
      const v = nome === "Paciente" ? reg.nome : reg.campos[nome];
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
      console.log(`    ${nome}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
  }
  console.log(`\nPara executar de verdade: npm run sync:notion -- --apply\n`);
}

async function main() {
  const registros = await montarRegistros();

  if (!APLICAR) {
    relatorioDryRun(registros);
    return;
  }

  if (!NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN ausente no .env — defina antes de rodar com --apply.");
  }

  console.log(`Sincronizando ${registros.length} pacientes com o Notion...`);
  const databaseId = await acharOuCriarDatabase();

  let criados = 0;
  let atualizados = 0;
  let falhas = 0;

  for (const reg of registros) {
    try {
      const props = propriedadesDaPagina(reg);
      const paginaId = await acharPagina(databaseId, reg.id);
      if (paginaId) {
        await notion(`/pages/${paginaId}`, "PATCH", { properties: props });
        atualizados++;
        console.log(`  ~ atualizado: ${reg.nome}`);
      } else {
        await notion("/pages", "POST", {
          parent: { database_id: databaseId },
          properties: props,
        });
        criados++;
        console.log(`  + criado:     ${reg.nome}`);
      }
    } catch (e) {
      falhas++;
      console.error(`  ! falha em ${reg.nome}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`  Criados:     ${criados}`);
  console.log(`  Atualizados: ${atualizados}`);
  console.log(`  Falhas:      ${falhas}`);
  console.log(`  Total:       ${registros.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
