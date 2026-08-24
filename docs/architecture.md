# Decisões de arquitetura — Etapa 1

## Módulos e dependências

A API usa módulos por domínio (`auth`, `admins`, `jogadores`). Rotas tratam HTTP, serviços validam e coordenam casos de uso, e repositórios isolam o Prisma. `buildApp` recebe dependências explicitamente, permitindo testes rápidos com o mesmo fluxo HTTP e sem banco externo.

## Sessão

O cliente recebe apenas um identificador opaco aleatório de 256 bits em cookie assinado. A sessão fica no servidor, expira em oito horas e pode ser revogada no logout. `HttpOnly` reduz exposição a scripts, `SameSite=Lax` reduz CSRF e `Secure` é habilitado automaticamente em produção.

Para uma futura implantação horizontal, `SessionStore` deve ganhar uma implementação compartilhada. Isso é uma mudança de infraestrutura, não de contrato da API.

## Privacidade

O DTO público é construído por lista explícita (`id`, `nome`, `apelido`, `ativo`). Telefone só integra o DTO administrativo, depois da autorização. Assim, a privacidade não depende de CSS ou de ocultação no navegador.

## Mobile first

O painel usa cards responsivos em vez de tabela. Em telas pequenas há menu lateral sob demanda e navegação fixa inferior para ações de uma mão. Modais surgem junto à borda inferior e respeitam a altura visual do navegador; em telas maiores tornam-se diálogos centralizados.
