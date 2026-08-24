# Decisões de arquitetura — Etapas 1 a 4

## Módulos e dependências

A API usa módulos por domínio (`auth`, `admins`, `jogadores`). Rotas tratam HTTP, serviços validam e coordenam casos de uso, e repositórios isolam o Prisma. `buildApp` recebe dependências explicitamente, permitindo testes rápidos com o mesmo fluxo HTTP e sem banco externo.

## Sessão

O cliente recebe apenas um identificador opaco aleatório de 256 bits em cookie assinado. A sessão fica no servidor, expira em oito horas e pode ser revogada no logout. `HttpOnly` reduz exposição a scripts, `SameSite=Lax` reduz CSRF e `Secure` é habilitado automaticamente em produção.

Para uma futura implantação horizontal, `SessionStore` deve ganhar uma implementação compartilhada. Isso é uma mudança de infraestrutura, não de contrato da API.

## Privacidade

O DTO público é construído por lista explícita (`id`, `nome`, `apelido`, `ativo`). Telefone só integra o DTO administrativo, depois da autorização. Assim, a privacidade não depende de CSS ou de ocultação no navegador.

## Mobile first

O painel usa cards responsivos em vez de tabela. Em telas pequenas há menu lateral sob demanda e navegação fixa inferior para ações de uma mão. Modais surgem junto à borda inferior e respeitam a altura visual do navegador; em telas maiores tornam-se diálogos centralizados.

## Rodadas e consistência financeira

`PrismaRodadaRepository` encapsula as operações que alteram participação e pagamento na mesma transação. A constraint `(rodada_id, jogador_id)` garante que o jogador não se repita; `pagamentos.participacao_id` único garante uma cobrança por participação.

A elegibilidade financeira é derivada, nunca digitada: apenas `LINHA + presente` possui cobrança. Uma mudança para goleiro/ausente remove cobrança pendente ou cria a cobrança necessária de forma idempotente. Se a cobrança estiver paga, a alteração é bloqueada com `PAGAMENTO_PAGO`; o administrador precisa voltar o pagamento para pendente primeiro. Essa decisão evita apagar receita sem auditoria, que ainda não pertence a esta etapa.

Rodadas encerradas e canceladas são somente leitura. Cancelamento elimina cobranças pendentes dentro da transação e é bloqueado se houver qualquer pagamento pago.

## Motor de rodízio

O motor da Etapa 3 é puro e determinístico; o repositório Prisma persiste snapshots relacionais de cada ciclo. Operações concorrentes usam isolamento serializável e advisory lock por rodada. A auditoria registra chegada, correção de ordem, formação, rodízio, chegada tardia e saída sem misturar responsabilidades financeiras.

## Partidas e resultado real

`PrismaMatchRepository` mantém partidas e gols sobre o snapshot imutável do ciclo. Gols são a fonte de verdade do placar e só aceitam uma participação escalada no lado informado. A função pura `resolveMatch` separa resultado esportivo da consequência operacional: empate não tem vencedor, mas retira o time entrante.

A finalização persiste resultado e executa `rotateRoundInTransaction`, sem duplicar o motor da Etapa 3. Tudo ocorre sob o mesmo advisory lock e na mesma transação; a releitura do status depois do lock torna clique duplo idempotente no estado, e o índice parcial impede duas partidas em andamento. Consulte [match-engine.md](match-engine.md).

## Estatísticas derivadas

O módulo `statistics` consulta o histórico relacional e aplica o motor puro de métricas/rankings sem persistir totais. Jogadores, partidas com escalações/gols e presenças são carregados em três consultas paralelas, com filtros no banco e agregação em memória. Isso mantém correções históricas automaticamente consistentes e evita N+1. Consulte [statistics-engine.md](statistics-engine.md).
