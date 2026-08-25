# Checklist de produção

## Infraestrutura

- [ ] VPS Hostinger preparada com usuário não-root e Docker Compose.
- [ ] Repositório em `/opt/futbrita`, branch `main` e `.env.production` com modo 600.
- [ ] DuckDNS aponta para o IP público correto.
- [ ] Firewall expõe somente SSH, 80 e 443; PostgreSQL não possui porta publicada.
- [ ] Volumes `futbrita_postgres_data`, `futbrita_postgres_backups`, `futbrita_caddy_data` e `futbrita_caddy_config` existem.

## Primeiro deploy

- [ ] Compose validado com projeto explícito `futbrita`.
- [ ] PostgreSQL healthy.
- [ ] Backup inicial criado quando aplicável.
- [ ] `prisma migrate deploy` concluído.
- [ ] Seed executado duas vezes, com dois ADMs e sem duplicação ou troca silenciosa de senha.
- [ ] API e Caddy healthy; HTTPS válido em `futbrita.duckdns.org`.
- [ ] `GET /api/health` retorna banco conectado e nenhum segredo.

## Vercel, CORS e cookie

- [ ] Projeto Vercel existente usa `VITE_API_URL=https://futbrita.duckdns.org/api`.
- [ ] Frontend foi redeployado após configurar a variável.
- [ ] Origem oficial recebe CORS credenciado; origem negativa não recebe ACAO.
- [ ] Login retorna cookie `HttpOnly; Secure; SameSite=None; Path=/`.
- [ ] `/api/auth/me`, rota admin, logout e 401 pós-logout validados no navegador.

## PWA, logo e noindex

- [ ] Manifest válido, nome/descrição/cores e ícones 192/512.
- [ ] Service worker ativo sem cache de API, placar, gols, fila ou rankings.
- [ ] Instalação standalone e apple touch icon validados.
- [ ] Logo oficial visível na Home, login e headers.
- [ ] `robots.txt`, meta robots e `X-Robots-Tag` validados.

## Dados e automação

- [ ] Backup diário executa e retenção 7/4 foi inspecionada.
- [ ] Restore em `futbrita_restore_*` validou tabelas e removeu somente o banco temporário.
- [ ] GitHub environment/secrets configurados e pipeline de `main` aprovado.
- [ ] Falha de teste impede deploy; falha de migration encerra o workflow.

## Validação funcional

- [ ] E2E administrativo completo: login, rodada, jogadores, goleiros, presença, pagamentos, chegada, times, gols, rodízio, empate, encerramento, rankings, perfil, histórico, financeiro e logout.
- [ ] E2E público sem telefone, pagamentos ou controles administrativos.
- [ ] Estados vazio, offline, API/banco indisponível, sessão expirada e erro inesperado revisados.
- [ ] 390x844, 430x932, 768x1024 e 1440x900 sem overflow horizontal.
- [ ] Lint, typecheck, testes, integrações, build, Prisma validate e `npm audit` registrados.
