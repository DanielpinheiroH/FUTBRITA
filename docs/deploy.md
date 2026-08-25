# Deploy de produção

## Preparação única da VPS

1. Crie um usuário não-root `deploy`, conceda acesso somente ao repositório `/opt/futbrita` e ao grupo Docker, e configure SSH por chave.
2. Instale Docker Engine, Compose plugin, Git e UFW pela documentação oficial da distribuição.
3. Clone `https://github.com/DanielpinheiroH/FUTBRITA` em `/opt/futbrita` e mantenha a branch `main`.
4. Crie `/opt/futbrita/.env.production` a partir do exemplo e execute `chmod 600 .env.production`.
5. Atualize o A record do DuckDNS para o IP da VPS e libere somente SSH/80/443.

O usuário `deploy` precisa ler o repositório, executar Docker Compose e atualizar a cópia Git. Não precisa de login root por SSH.

## Primeiro deploy

Valide o alvo antes de subir serviços:

```sh
cd /opt/futbrita
docker compose -p futbrita -f docker-compose.prod.yml config
docker compose -p futbrita -f docker-compose.prod.yml up -d postgres
docker compose -p futbrita -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose -p futbrita -f docker-compose.prod.yml run --rm api npm run db:seed -w @fut-brita/api
docker compose -p futbrita -f docker-compose.prod.yml up -d api caddy backup
docker compose -p futbrita -f docker-compose.prod.yml ps
```

Execute o seed novamente: deve informar dois administradores existentes e não alterar suas senhas.

Na Vercel, mantenha o projeto existente, configure `VITE_API_URL=https://futbrita.duckdns.org/api` para Production e faça redeploy. Se o Root Directory for `apps/web`, o `vercel.json` e a saída `dist` serão reconhecidos nesse diretório.

## GitHub Actions

Push em `main` executa `.github/workflows/deploy-production.yml`. O job `validate` sobe PostgreSQL isolado, aplica migrations e seed, e executa lint, typecheck, testes, integrações e build. O job `deploy` só inicia se tudo passar.

Crie um environment GitHub chamado `production` com proteção apropriada e estes secrets:

- `VPS_HOST`: IP ou hostname SSH;
- `VPS_USER`: usuário não-root;
- `VPS_SSH_KEY`: chave privada exclusiva de deploy;
- `VPS_PORT`: porta SSH.

O servidor precisa já possuir o `known_hosts` correto para o Git remoto e credencial de leitura do repositório, se necessária. O workflow registra a chave da VPS com `ssh-keyscan` e executa `scripts/deploy-production.sh`.

## Ordem segura do deploy da API

O script valida Compose e env, faz `git pull --ff-only`, constrói a imagem, sobe somente o PostgreSQL FUTBRITA, gera backup, executa `prisma migrate deploy`, executa seed idempotente, recria API/Caddy/backup sem remover volumes e aguarda health real. Não existe `down -v`.

Se backup, migration, seed ou health falhar, o script termina com erro. Não tente `prisma migrate dev` em produção. Siga o runbook antes de novo deploy.

## Validação pós-deploy

```sh
curl -fsS https://futbrita.duckdns.org/api/health
curl -I https://futbrita.duckdns.org/api/health
curl -I -H 'Origin: https://futbrita-api.vercel.app' https://futbrita.duckdns.org/api/health
curl -I -H 'Origin: https://origem-invalida.example' https://futbrita.duckdns.org/api/health
```

No navegador, abra a Vercel, autentique, confirme `Set-Cookie` com `Secure; HttpOnly; SameSite=None`, valide `/api/auth/me`, abra uma rota administrativa, faça logout e confirme 401. Não registre credenciais em screenshots ou logs.
