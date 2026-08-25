# Produção do Fut Brita

## Arquitetura oficial

O frontend é publicado pela Vercel em `https://futbrita-api.vercel.app`. A API Fastify, o PostgreSQL, o Caddy e o executor de backup ficam na VPS Hostinger. A API pública é `https://futbrita.duckdns.org/api`.

Fluxo: `Vercel -> HTTPS/DuckDNS -> Caddy -> Fastify -> PostgreSQL`.

O PostgreSQL participa somente da rede Docker interna `backend`, não publica a porta 5432 e persiste no volume nomeado `futbrita_postgres_data`. O Caddy é o único componente que publica 80/443. Nunca execute `docker compose down -v` em produção.

## Variáveis

Copie `.env.production.example` para `.env.production`, limite o arquivo a `chmod 600` e substitua todos os marcadores. Não reutilize os valores de desenvolvimento.

- `DATABASE_URL` usa `postgres:5432`, nunca `localhost` ou IP público.
- `SESSION_SECRET` deve ser aleatório e ter no mínimo 64 caracteres em produção.
- `CORS_ORIGIN` deve ser exatamente `https://futbrita-api.vercel.app`, sem barra final.
- `ADMIN_1_*` e `ADMIN_2_*` devem identificar dois administradores distintos.
- `DUCKDNS_TOKEN` é segredo operacional e nunca entra no Git.

Gere segredos na VPS com `openssl rand -base64 48`. Não cole o resultado em tickets, logs ou workflow.

## Cookies, CORS e segurança

Em produção, `fut_brita_session` usa `HttpOnly`, `Secure`, `SameSite=None`, `Path=/`, assinatura e validade de oito horas. Em desenvolvimento, usa `SameSite=Lax` e não exige HTTPS. O frontend centraliza a API em `VITE_API_URL` e envia `credentials: include`.

A API habilita Helmet, CORS credenciado para uma única origem, limite de cinco tentativas de login a cada 15 minutos e logs JSON com senha, autorização, cookies e `Set-Cookie` redigidos. O Caddy adiciona HSTS e remove o header `Server`.

As sessões são mantidas em memória no único contêiner da API. Um restart invalida sessões administrativas existentes; isso é seguro e esperado nesta arquitetura sem Redis.

## DuckDNS e firewall

Configure `futbrita.duckdns.org` para o IP público da VPS usando o painel/API do DuckDNS. O token fica somente no gerenciador de segredos ou na VPS. Valide com `dig +short futbrita.duckdns.org` e confirme que o IP retornado é o da VPS.

No firewall da Hostinger e no UFW, permita apenas SSH na porta escolhida, TCP 80 e TCP/UDP 443. Exemplo, ajustando antes a porta SSH:

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Nunca libere 5432 ou 5433. Verifique com `docker compose -p futbrita -f docker-compose.prod.yml ps` e `ss -lntup`.

## PWA e privacidade de indexação

O frontend contém manifest, service worker, ícones 192/512, apple touch icon e favicon derivados da logo oficial. O cache abrange apenas shell/assets estáticos; navegações são network-first e a API dinâmica nunca é cacheada. Não há push ou pedido de permissão.

`robots.txt`, meta robots e o header Vercel `X-Robots-Tag` aplicam `noindex, nofollow, noarchive`. Isso reduz indexação, mas não é controle de acesso; o site continua público por link.

## Operação e observabilidade

Health interno e público: `GET /api/health`, esperado `{"status":"ok","database":"connected"}`. O Compose exige health de PostgreSQL e API e usa `restart: unless-stopped`. Consulte logs sem segredos com:

```sh
docker compose -p futbrita -f docker-compose.prod.yml ps
docker compose -p futbrita -f docker-compose.prod.yml logs --tail=200 api caddy
```

Procedimentos de incidente estão em `docs/runbook.md`.
