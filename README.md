# FUT BRITA

Aplicação web mobile first para organizar a pelada semanal Fut Brita. As Etapas 1 a 4 incluem autenticação, jogadores, rodadas, financeiro, formação, fila, rodízio e controle transacional das partidas reais com gols e placar.

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

### Rodadas e financeiro

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/admin/rodadas` | Administrador |
| GET | `/api/admin/rodadas/:id` | Administrador |
| POST | `/api/admin/rodadas` | Administrador |
| PATCH | `/api/admin/rodadas/:id` | Administrador |
| POST | `/api/admin/rodadas/:id/participantes` | Administrador |
| POST | `/api/admin/rodadas/:id/participantes/novo-jogador` | Administrador |
| PATCH | `/api/admin/participacoes/:id` | Administrador |
| DELETE | `/api/admin/participacoes/:id` | Administrador |
| GET | `/api/admin/rodadas/:id/financeiro` | Administrador |
| PATCH | `/api/admin/pagamentos/:id` | Administrador |
| GET | `/api/public/rodadas/atual` | Público; sem telefone ou financeiro |
| GET | `/api/public/rodadas/:id` | Público; sem telefone ou financeiro |

Páginas novas: `/rodada`, `/admin/rodadas`, `/admin/rodadas/nova` e `/admin/rodadas/:id`.

## Fluxo da rodada

1. O administrador cria a rodada com data, horário padrão `20:00` e valor padrão `R$ 11,00`.
2. A rodada segue `PLANEJADA → PREPARACAO → ENCERRADA`, ou pode ser cancelada antes do encerramento.
3. Jogadores existentes ou cadastrados rapidamente recebem um tipo apenas naquela rodada: `LINHA` ou `GOLEIRO`.
4. Somente `LINHA + presente` gera uma cobrança pendente com o valor histórico da rodada.
5. Goleiro ou ausente não paga. Mudanças de presença/tipo reconciliam a cobrança em transação.
6. Pagamento alterna entre `PENDENTE` e `PAGO`; o resumo apresenta previsto, recebido e pendente.

Uma cobrança paga nunca é removida silenciosamente. Antes de tornar o participante ausente/goleiro, removê-lo ou cancelar a rodada, o administrador deve corrigir o pagamento para pendente. Rodadas encerradas e canceladas são somente leitura.

Migration incremental da Etapa 2: `20260824000000_etapa_2_rodadas`. Ela cria `rodadas`, `participacoes_rodada`, `pagamentos`, enums, chaves estrangeiras e as constraints únicas `(rodada_id, jogador_id)` e `participacao_id`.

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
npm run test:integration
npm run build
npx prisma validate --schema apps/api/prisma/schema.prisma
```

A suíte de API cobre login correto/incorreto, logout, proteção sem sessão, criação, listagem/pesquisa, edição, inativação, campos obrigatórios e privacidade do telefone.

Os testes da Etapa 2 cobrem status da rodada, participantes, cadastro rápido, presença, Linha/Goleiro, cobrança idempotente, pagamento, resumo e privacidade. O comando de integração carrega o `.env` local e usa por padrão o administrador inicial; `INTEGRATION_ADMIN_EMAIL` e `INTEGRATION_ADMIN_PASSWORD` podem sobrescrever essas credenciais:

```powershell
$env:INTEGRATION_ADMIN_EMAIL="seu-admin@exemplo.com"
$env:INTEGRATION_ADMIN_PASSWORD="sua-senha"
npm run test:integration
```

## Etapa 3 — chegada, times, fila e rodízio

A migration `20260824010000_etapa_3_motor_rodizio` adiciona ordem e horários de chegada/saída, estado do motor, snapshots de ciclos, escalações, fila, permanências e auditoria.

- 6 linhas por time; goleiros nunca entram no motor;
- formação inicial alternada: ímpares no Time 1 e pares no Time 2;
- fila FIFO da 13ª chegada em diante;
- permanência por menor contador, maior tempo sem permanecer e ordem original;
- chegada tardia no fim da fila e saída com reposição pela primeira pessoa da fila;
- transação serializável e lock por rodada nas operações concorrentes.

Endpoints: `GET/POST /api/admin/rodadas/:id/chegadas`, `PUT /api/admin/rodadas/:id/chegadas/reordenar`, `DELETE /api/admin/rodadas/:id/chegadas/:participacaoId`, `POST /api/admin/rodadas/:id/formacao-inicial`, `GET /api/admin/rodadas/:id/estado-jogo`, `POST /api/admin/rodadas/:id/rodizio` e `PATCH /api/admin/participacoes/:id/saida`.

A área pública mostra apenas times e fila. O algoritmo está documentado em [docs/rotation-engine.md](docs/rotation-engine.md). A decisão manual de qual time sai deixou de ser o fluxo operacional normal na Etapa 4.

## Etapa 4 — partidas, jogo ao vivo, placar e gols

A migration incremental `20260824020000_etapa_4_partidas_gols` cria `partidas` e `gols`, os enums `StatusPartida` e `ResultadoPartida`, índices de consulta, unicidade por ciclo/número/evento e um índice parcial que garante no máximo uma partida em andamento por rodada.

O ADM opera em `/admin/rodadas/:id/jogo`: inicia a partida pronta, registra o gol em dois toques escolhendo somente um dos seis linhas escalados, corrige ou exclui eventos e finaliza com confirmação. O placar é derivado dos gols. A barra principal permanece acessível na parte inferior do celular e a finalização desabilita ações enquanto processa.

Regra esportiva e operacional:

- quem vence permanece e o outro time sai;
- em qualquer empate, inclusive 0 × 0, o time permanente fica e o entrante sai;
- empate persiste como `EMPATE`, sem vencedor e sem derrota estatística;
- no primeiro jogo o Time 1 possui a vantagem inicial do empate;
- nos jogos seguintes a vantagem acompanha a equipe que permaneceu.

A finalização reutiliza o motor da Etapa 3 dentro da mesma transação, gera o próximo ciclo e não inicia automaticamente a próxima partida. Advisory lock, releitura de status e constraint de banco impedem dupla finalização e ciclos duplicados. Gols, resultado, rodízio e auditoria sofrem rollback conjunto em qualquer falha.

Endpoints administrativos:

| Método | Rota |
| --- | --- |
| POST | `/api/admin/rodadas/:id/partidas/iniciar` |
| GET | `/api/admin/rodadas/:id/partidas` |
| GET | `/api/admin/rodadas/:id/partidas/atual` |
| GET | `/api/admin/partidas/:id` |
| POST | `/api/admin/partidas/:id/gols` |
| PATCH | `/api/admin/gols/:id` |
| DELETE | `/api/admin/gols/:id` |
| POST | `/api/admin/partidas/:id/finalizar` |

`GET /api/public/rodadas/atual` e `GET /api/public/rodadas/:id` incluem o jogo atual, escalações, autores de gols e fila sem telefone, financeiro, autenticação ou auditoria. A atualização pública usa polling leve. O desenho completo está em [docs/match-engine.md](docs/match-engine.md).

Os testes da Etapa 4 cobrem gols, placar derivado, correções, vitórias, empates 0×0/1×1/2×2/5×5, primeira partida, transferência e sequência de vantagem. As integrações reais cobrem 16 e 20 jogadores, privacidade pública, clique duplo, rotação e rollback.

## Etapa 5 — estatísticas, rankings, perfis e histórico

As estatísticas são derivadas diretamente das partidas finalizadas, escalações, resultados, gols e presenças. Não existem contadores manuais nem cache materializado. A migration incremental `20260824030000_etapa_5_indices_estatisticas` adiciona somente índices para acelerar filtros por jogador, escalação e período.

Métricas disponíveis: partidas, vitórias, empates, derrotas, gols, média de gols, pontos, aproveitamento, presenças, sequência atual e maior sequência. Empate conta para os 12 jogadores escalados, inclusive para o time entrante que sai pela regra operacional.

Rankings públicos em `/rankings`: artilharia, vitórias, aproveitamento, jogos, presenças, média de gols e sequências. Todos suportam histórico geral, temporada, rodada e `minGames` na API. Perfis em `/jogadores/:id` mostram números reais e histórico detalhado por rodada. `/historico` e `/historico/:id` exibem rodadas encerradas, placares, gols e destaques sem dados financeiros.

Endpoints públicos:

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/public/jogadores/:id/estatisticas` | Perfil; `season`, `roundId` ou `scope=all` |
| GET | `/api/public/rankings` | `type`, período e `minGames` |
| GET | `/api/public/rodadas/:id/resumo` | Resumo e destaques da rodada |
| GET | `/api/public/historico` | Rodadas encerradas |
| GET | `/api/public/historico/:id` | Partidas, gols e ranking da rodada |
| GET | `/api/public/estatisticas/temporadas` | Anos disponíveis |
| GET | `/api/public/estatisticas/resumo` | Dashboard público |

O motor e os desempates estão documentados em [docs/statistics-engine.md](docs/statistics-engine.md). Os testes cobrem cálculos puros, filtros, jogadores inativos, goleiros, privacidade e um fluxo PostgreSQL real com vitória, empate e derrota.

## Fora do escopo atual

Assistências, cartões, votação de MVP, notas, nível técnico, estatísticas de goleiro e balanceamento por habilidade permanecem fora do escopo.

## Etapa 6 — produção real

A arquitetura de produção preserva o frontend Vercel em `https://futbrita-api.vercel.app`, publica a API Fastify por Caddy em `https://futbrita.duckdns.org/api` e mantém PostgreSQL privado na VPS. O arquivo `docker-compose.prod.yml` contém somente os serviços FUTBRITA `api`, `postgres`, `caddy` e `backup`, com volumes persistentes, healthchecks e restart seguro.

Principais garantias:

- CORS credenciado para a origem oficial e cookie cross-site `HttpOnly`, `Secure`, `SameSite=None` em produção;
- Helmet, rate limit de login e logs estruturados com campos sensíveis redigidos;
- seed idempotente de dois administradores e `npm run admin:set-password -- --email EMAIL --password NOVA_SENHA`;
- PWA instalável com logo oficial, cache somente de assets, favicon/apple icon e noindex;
- backup `pg_dump -Fc` diário, sete diários, quatro semanais e restore testado somente em banco temporário;
- pipeline de `main` com qualidade, PostgreSQL real, backup, `prisma migrate deploy` e health pós-deploy, sem remover volumes.

Use `.env.production.example` somente como modelo. Os valores reais ficam em `.env.production`, ignorado pelo Git. Nunca execute `docker compose down -v` em produção.

Documentação operacional:

- [Produção](docs/production.md)
- [Deploy](docs/deploy.md)
- [Runbook](docs/runbook.md)
- [Checklist](docs/production-checklist.md)
