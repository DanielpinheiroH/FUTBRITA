import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from '../src/app.js'

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true'

describe.skipIf(!enabled)('Etapa 2 no PostgreSQL real', () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  let cookie = ''
  const rodadaIds: string[] = []
  const jogadorIds: string[] = []

  beforeAll(async () => {
    prisma = new PrismaClient(); await prisma.$connect()
    app = await buildApp({ SESSION_SECRET: process.env.SESSION_SECRET!, NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, createPrismaDependencies(prisma))
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: process.env.INTEGRATION_ADMIN_EMAIL, senha: process.env.INTEGRATION_ADMIN_PASSWORD } })
    expect(login.statusCode).toBe(200)
    cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ')
  })
  afterAll(async () => {
    if (rodadaIds.length) await prisma.rodada.deleteMany({ where: { id: { in: rodadaIds } } })
    if (jogadorIds.length) await prisma.jogador.deleteMany({ where: { id: { in: jogadorIds } } })
    await app.close(); await prisma.$disconnect()
  })

  it('confirma tabelas, relações e constraint única da migration incremental', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('rodadas', 'participacoes_rodada', 'pagamentos') ORDER BY tablename`
    expect(tables.map((row) => row.tablename)).toEqual(['pagamentos', 'participacoes_rodada', 'rodadas'])
    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`SELECT conname AS name FROM pg_constraint WHERE conname IN ('rodadas_created_by_fkey', 'participacoes_rodada_rodada_id_fkey', 'participacoes_rodada_jogador_id_fkey', 'pagamentos_participacao_id_fkey', 'pagamentos_updated_by_fkey') ORDER BY conname`
    expect(constraints).toHaveLength(5)
  })

  it('executa rodada, Linha, Goleiro, cobrança, pagamento, resumo e privacidade', async () => {
    const suffix = Date.now().toString()
    const round = await app.inject({ method: 'POST', url: '/api/admin/rodadas', headers: { cookie }, payload: { data: '2099-08-26' } })
    expect(round.statusCode).toBe(201); rodadaIds.push(round.json().id)
    const linePlayer = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Linha Integração ${suffix}`, apelido: `Linha${suffix}`, telefone: '(61) 99999-9999' } })
    expect(linePlayer.statusCode).toBe(201); jogadorIds.push(linePlayer.json().id)
    const line = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${round.json().id}/participantes`, headers: { cookie }, payload: { jogadorId: linePlayer.json().id, tipo: 'LINHA', confirmado: true, presente: true } })
    expect(line.statusCode).toBe(201)
    expect(line.json().participacoes[0].pagamento).toMatchObject({ valor: 11, status: 'PENDENTE' })
    const duplicate = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${round.json().id}/participantes`, headers: { cookie }, payload: { jogadorId: linePlayer.json().id, tipo: 'LINHA', confirmado: true, presente: true } })
    expect(duplicate.statusCode).toBe(409); expect(duplicate.json().error).toBe('JOGADOR_JA_PARTICIPA')
    const paid = await app.inject({ method: 'PATCH', url: `/api/admin/pagamentos/${line.json().participacoes[0].pagamento.id}`, headers: { cookie }, payload: { status: 'PAGO' } })
    expect(paid.statusCode).toBe(200); expect(paid.json().participacoes[0].pagamento.pagoEm).toBeTruthy()
    const keeper = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${round.json().id}/participantes/novo-jogador`, headers: { cookie }, payload: { nome: `Goleiro Integração ${suffix}`, apelido: `GK${suffix}`, telefone: '(61) 98888-7777', tipo: 'GOLEIRO', confirmado: true, presente: true } })
    expect(keeper.statusCode).toBe(201)
    const keeperParticipation = keeper.json().participacoes.find((p: { tipo: string }) => p.tipo === 'GOLEIRO')
    jogadorIds.push(keeperParticipation.jogador.id); expect(keeperParticipation.pagamento).toBeNull()
    const financial = await app.inject({ method: 'GET', url: `/api/admin/rodadas/${round.json().id}/financeiro`, headers: { cookie } })
    expect(financial.json()).toEqual({ totalParticipantes: 2, linhasPresentes: 1, goleirosPresentes: 1, ausentes: 0, totalPrevisto: 11, totalRecebido: 11, totalPendente: 0 })
    const publicRound = await app.inject({ method: 'GET', url: `/api/public/rodadas/${round.json().id}` })
    expect(publicRound.statusCode).toBe(200); expect(publicRound.json().participacoes).toHaveLength(2)
    for (const privateField of ['telefone', 'pagamento', 'valor', 'totalRecebido', 'totalPendente', 'updatedBy']) expect(publicRound.body).not.toContain(privateField)
  })
})
