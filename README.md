# Nutre.AI — MVP

Serviço de avaliação e acompanhamento nutricional por assinatura do nutricionista **Eudes Pereira (CRN 52959)**. Cliente conversa com o bot via chat web; o nutricionista revisa e libera cada dieta num painel admin.

**Regra de ouro:** nenhum plano alimentar chega ao cliente sem liberação do nutricionista. A trava é de **backend** (status no banco): a dieta é gerada numa chamada separada — invisível ao chat — e só entra no contexto do modelo/na conversa quando o status vira `liberado`.

## Stack

- Next.js (App Router, TypeScript) — frontend + API routes
- SQLite via Prisma (migração fácil p/ Postgres: trocar `provider` no `prisma/schema.prisma` e a `DATABASE_URL`)
- API da Anthropic (`claude-sonnet-5` por padrão; configurável por env)
- Tailwind CSS

## Setup

```bash
npm install
cp .env.example .env      # preencha as variáveis (abaixo)
npx prisma db push        # cria o SQLite
npm run db:seed           # cria o admin com ADMIN_PASSWORD
npm run dev               # http://localhost:3000
```

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) — trocar por URL Postgres depois |
| `ANTHROPIC_API_KEY` | **obrigatória** — chat e geração de dietas |
| `ANTHROPIC_MODEL` | modelo da conversa (padrão `claude-sonnet-5`) |
| `ADMIN_EMAIL` | e-mail do admin criado no seed |
| `ADMIN_PASSWORD` | senha do admin (o seed grava o hash bcrypt) |
| `SESSION_SECRET` | segredo do cookie de sessão do admin (string longa aleatória) |
| `APP_URL` | base p/ montar links mágicos (ex.: `http://localhost:3000`) |

## Telas

- `/c/[token]` — chat do cliente (link mágico, mobile-first). Criado no painel em **Clientes → Novo cliente**.
- `/admin` — login → fila de casos pendentes (flags de revisão em vermelho) → detalhe: anamnese resumida, resumo técnico, dieta editável, **Liberar** / **Devolver com instruções** (devolução regenera com IA e volta à fila).
- `/admin/clientes` — status, índice de progressão, último contato (recaptação manual), link mágico, exclusão de dados (LGPD).

## Como funciona (arquitetura da trava)

1. O bot conduz a entrevista (Etapas 0–9 do prompt) e, na confirmação, emite um bloco estruturado `<<<NUTRE_EVENTO:anamnese_completa>>> {json} <<<FIM_NUTRE_EVENTO>>>` que o backend intercepta e **remove do texto** antes de salvar/exibir.
2. O backend roda os cálculos em **código TypeScript puro** (`src/lib/calculos.ts` — Mifflin-St Jeor, GET, meta, MME p/ IMC≥30, macros ±2%, hidratação) e re-checa flags deterministicamente (menor de idade, gestação, IMC<17 etc.).
3. Uma **chamada separada** (nunca exibida no chat) gera resumo técnico + dieta usando os números prontos.
4. O **validador em código** (`src/lib/validador.ts`) confere: meta ≥ TMB, soma dos macros = meta ±2%, termos proibidos (detox, secar, queimar gordura…), meta declarada no texto = calculada. Falhou → regenera (máx. 2x) → persiste com `erroValidacao` para revisão manual.
5. A dieta é salva `pendente_revisao`. O chat do cliente mostra apenas "em revisão". O system prompt do chat **só recebe dietas `liberado`** — o modelo não tem como vazar o que não conhece.
6. Ao **Liberar** no painel (com edição opcional; termos proibidos são bloqueados mesmo em texto editado), o plano é publicado como mensagem no chat + registro em `Auditoria`.
7. Check-ins geram comparativo e atualizam o índice de progressão (40% adesão + 40% evolução + 20% consistência) **sem nova dieta**; o retorno mensal (guard em código: ≥26 dias desde a última liberação) gera a dieta do ciclo seguinte, que volta à fila.

O system prompt é montado de `prompts/nutre-ai-prompt-v2.md` + `prompts/nutre-ai-restricoes.md` (Regras Duras, Guia Alimentar Operacionalizado, Comunicação e Oferta) + estado do caso injetado. Os comandos `/liberar`, `/resumo` etc. da spec original **não existem no chat** — viraram fluxo do painel/backend.

## Testes

```bash
npm test                          # unitários: cálculos (29) + validador (10)
npx tsx scripts/teste-trava.ts    # trava de backend sem IA (requer servidor rodando)
npx tsx scripts/teste-aceite.ts   # aceite E2E com personas (requer ANTHROPIC_API_KEY com créditos e servidor rodando)
```

Caso de referência dos cálculos: homem 35a/90kg/175cm/fator 1,375 → TMB 1824, GET ≈2508, meta −20% ≈2006 kcal.

O script de aceite simula as 3 personas (caso simples, gestante com flag, retorno mensal) usando um cliente simulado por LLM e verifica no banco: dieta invisível até liberação, flag vermelho, check-in sem dieta nova, retorno com dieta nova na fila.

## LGPD / CRN

- Consentimento LGPD específico e destacado antes de qualquer coleta (Etapa 0), com timestamp; consentimento separado para fotos.
- Pedido de exclusão no chat → registro em auditoria + pausa do acompanhamento; exclusão efetiva pelo painel (cascade) com trilha em `Auditoria`.
- `Auditoria` registra: consentimentos, gerações de dieta, liberações, devoluções, falhas de validação, exclusões.
- Pendências fora do MVP: TCLE formal (Res. CFN 760/2023) como documento à parte, cadastro e-Nutricionista, upload real de fotos (hoje o bot apenas orienta e registra a resposta), pagamento (cobrança manual via Pix/link — campo `status` do cliente já preparado: `ativo | pausado | perdido`).

## Deploy / produção

- Trocar SQLite por Postgres (schema + `DATABASE_URL`), gerar `SESSION_SECRET` forte, `ADMIN_PASSWORD` forte, HTTPS obrigatório (cookie `secure` já ativo em produção).
