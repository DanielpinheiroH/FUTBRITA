# Runbook de produção

Todos os comandos partem de `/opt/futbrita` e usam explicitamente `-p futbrita -f docker-compose.prod.yml`. Antes de qualquer ação, execute `docker compose ... config --services` e `docker compose ... ps` para confirmar o alvo. Nunca use `down -v`.

## API fora ou health degradado

1. Consulte `ps` e os últimos 200 logs de `api` e `caddy`.
2. Teste health interno no contêiner API e `pg_isready` no PostgreSQL.
3. Se o banco estiver conectado, recrie somente `api`: `docker compose -p futbrita -f docker-compose.prod.yml up -d --no-deps api`.
4. Se persistir, volte ao último commit conhecido conforme a seção rollback.

## Banco fora

Não remova nem recrie o volume. Verifique espaço em disco, memória, health e logs do serviço `postgres`. Reinicie somente esse serviço se a causa for compreendida. Antes de qualquer restore, preserve uma cópia do volume/backup e nunca use o banco principal como alvo de teste.

## CORS, login e cookie

- Confirme `CORS_ORIGIN=https://futbrita-api.vercel.app`, sem barra final.
- Confirme `VITE_API_URL=https://futbrita.duckdns.org/api` na Vercel.
- Em DevTools, verifique preflight, `Access-Control-Allow-Origin` exato, `Access-Control-Allow-Credentials: true` e cookie `Secure; HttpOnly; SameSite=None`.
- Se `/auth/me` falhar após restart, refaça login: sessões em memória são intencionalmente invalidadas.
- Uma origem desconhecida não deve receber `Access-Control-Allow-Origin`.

## HTTPS e DuckDNS

Compare `dig +short futbrita.duckdns.org` ao IP público da VPS. Confira portas 80/443 e logs do Caddy. Erro de nome no certificado normalmente indica DNS apontando ao host errado ou emissão do Caddy ainda não concluída. Não contorne aviso TLS no navegador e não habilite login por HTTP.

## Migration com falha

Pare o deploy. Registre a migration e o erro, valide o backup criado imediatamente antes e consulte `npx prisma migrate status`. Não edite migration já aplicada e não marque resolução sem revisar o banco. Corrija em nova migration e execute novamente `prisma migrate deploy`.

## Backup diário e retenção

Forçar backup seguro:

```sh
docker compose -p futbrita -f docker-compose.prod.yml run --rm backup sh /scripts/backup-postgres.sh --once
docker compose -p futbrita -f docker-compose.prod.yml exec backup find /backups -type f -name '*.dump' -ls
```

O job mantém sete diários (`mtime` até seis dias) e quatro semanais (`mtime` até 27 dias). Backups ficam no volume `futbrita_postgres_backups`, fora do Git.

## Teste de restore temporário

Selecione um arquivo já listado e use apenas um nome com prefixo obrigatório:

```sh
docker compose -p futbrita -f docker-compose.prod.yml run --rm backup sh /scripts/restore-backup.sh /backups/daily/ARQUIVO.dump futbrita_restore_$(date +%s)
```

O script recusa o banco principal, valida cinco tabelas essenciais e remove o banco temporário por trap, inclusive em erro.

## Troca manual de senha

Na VPS, evite deixar a senha no histórico usando variáveis temporárias no shell e limpe-as ao terminar:

```sh
read -r ADMIN_EMAIL
read -rs NEW_ADMIN_PASSWORD
export ADMIN_EMAIL NEW_ADMIN_PASSWORD
docker compose -p futbrita -f docker-compose.prod.yml exec -T api npm run admin:set-password -w @fut-brita/api
unset ADMIN_EMAIL NEW_ADMIN_PASSWORD
```

Não existe recuperação por e-mail. Confirme o login e encerre a sessão anterior.

## Reinício e rollback

Reinicie somente componentes FUTBRITA identificados por `ps`. Para rollback de aplicação, escolha um commit conhecido, faça checkout desse commit na VPS, reconstrua `api`, suba somente `api`/`caddy` e valide health. Migrations destrutivas não são revertidas automaticamente; restaure em banco novo e faça corte controlado somente após análise. Nunca restaure sobre o banco principal como tentativa.
