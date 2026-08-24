# FUT BRITA

Aplicação web mobile first para organizar a pelada semanal Fut Brita. Esta entrega contém exclusivamente a **Etapa 1 — Fundação**: autenticação administrativa, gestão de jogadores e consulta pública com privacidade de telefone.

## Stack

- Web: React 19, Vite, TypeScript, Tailwind CSS e React Router
- API: Node.js, Fastify, TypeScript e Zod
- Banco: PostgreSQL 16 e Prisma ORM
- Testes: Vitest e `fastify.inject`
- Organização: monorepo com npm workspaces

## Estrutura

```text
apps/
  api/       API, módulos, Prisma, migration, seed e testes
  web/       aplicação React pública e administrativa
packages/
  shared/    schemas Zod, DTOs e tipos compartilhados
docs/        decisões de arquitetura
```

O backend separa rotas, serviços, repositórios, schemas compartilhados e tratamento de erros. Os repositórios são injetáveis, o que permite testes HTTP isolados sem substituir regras reais por mocks nas rotas.

## Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Docker Desktop (opção recomendada para o PostgreSQL) ou PostgreSQL local

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env` e troque pelo menos `SESSION_SECRET`, `ADMIN_INITIAL_EMAIL` e `ADMIN_INITIAL_PASSWORD`. O segredo de sessão deve ter 32 caracteres ou mais. Não versionar o `.env`.

No PowerShell:

```powershell
Copy-Item .env.example .env
```

## Banco, migration e primeiro administrador

Suba somente o PostgreSQL:

```bash
docker compose up -d postgres
```

Gere o cliente e aplique a migration inicial em um banco vazio:

```bash
npm run db:generate
npm run db:migrate
```

Crie o primeiro administrador com as variáveis `ADMIN_INITIAL_NAME`, `ADMIN_INITIAL_EMAIL` e `ADMIN_INITIAL_PASSWORD` do `.env`:

```bash
npm run db:seed
```

O seed é idempotente pelo e-mail: cria o administrador caso não exista e reativa/atualiza seu nome caso já exista. A senha nunca fica no código nem no banco em texto puro; é armazenada com bcrypt (custo 12).

## Desenvolvimento

Inicie API e frontend juntos:

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3333`
- Health check: `http://localhost:3333/api/health`
- PostgreSQL: `localhost:5433` (porta externa dedicada para não conflitar com instalações locais na porta padrão)

Também é possível executar um workspace separadamente:

```bash
npm run dev -w @fut-brita/api
npm run dev -w @fut-brita/web
```

## Endpoints

### Saúde e autenticação

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público |
| POST | `/api/auth/logout` | Público/sessão atual |
| GET | `/api/auth/me` | Administrador |

### Jogadores

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/public/jogadores` | Público; somente ativos, sem telefone |
| GET | `/api/public/jogadores/:id` | Público; sem telefone |
| GET | `/api/admin/jogadores?q=dan` | Administrador; busca case insensitive |
| GET | `/api/admin/jogadores/:id` | Administrador |
| POST | `/api/admin/jogadores` | Administrador |
| PATCH | `/api/admin/jogadores/:id` | Administrador |

Não há exclusão física. A inativação utiliza `PATCH` com `{ "ativo": false }`.

## Segurança e privacidade

- Sessão opaca aleatória em cookie assinado `HttpOnly`, `SameSite=Lax` e `Secure` em produção
- Cookie nunca é acessado pelo JavaScript e nenhum token é salvo em `localStorage`
- Todas as rotas `/api/admin/*` validam sessão e administrador ativo no backend
- Respostas públicas usam DTO próprio e nunca consultam/exibem o telefone
- CORS restrito ao `WEB_ORIGIN`, com credenciais habilitadas
- Validação centralizada e respostas de erro padronizadas
- Senhas protegidas com bcrypt

A store de sessão desta fundação reside na memória do processo. Para múltiplas instâncias da API, deve ser substituída por uma store compartilhada (por exemplo Redis) sem alterar o cookie ou as rotas.

## Interface e responsividade

A interface parte de smartphones: navegação compacta, barra inferior no painel, áreas de toque de ao menos 44 px, cards no lugar de tabelas, formulário com teclado de telefone e modais limitados a `92svh`. Foi preparada para validação em `390×844`, `430×932`, `768×1024` e `1440×900`.

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

A suíte de API cobre login correto/incorreto, logout, proteção sem sessão, criação, listagem/pesquisa, edição, inativação, campos obrigatórios e privacidade do telefone.

## Escopo

Não fazem parte desta etapa: rodadas, presença, linha/goleiro, pagamentos, ordem de chegada, times, fila, rodízio, partidas, placar, gols, rankings ou histórico esportivo. Os atalhos públicos correspondentes mostram apenas “Em breve”, sem dados falsos.
