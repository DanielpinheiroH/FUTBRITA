import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from '../src/app.js'

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true'
type Json = Record<string, any>

describe.skipIf(!enabled)('Etapa 4 no PostgreSQL real', () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  let cookie = ''
  const roundIds: string[] = []
  const playerIds: string[] = []

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    const stale = await prisma.rodada.findMany({ where: { participacoes: { some: { jogador: { nome: { startsWith: 'Linha Partida ' } } } } }, select: { id: true, participacoes: { select: { jogadorId: true } } } })
    for (const round of stale) {
      await prisma.partida.deleteMany({ where: { rodadaId: round.id } })
      await prisma.cicloRodada.deleteMany({ where: { rodadaId: round.id } })
      await prisma.permanenciaRodada.deleteMany({ where: { rodadaId: round.id } })
      await prisma.rodada.delete({ where: { id: round.id } })
      await prisma.jogador.deleteMany({ where: { id: { in: round.participacoes.map((item) => item.jogadorId) } } })
    }
    app = await buildApp(
      { SESSION_SECRET: process.env.SESSION_SECRET!, NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' },
      createPrismaDependencies(prisma),
    )
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: process.env.INTEGRATION_ADMIN_EMAIL, senha: process.env.INTEGRATION_ADMIN_PASSWORD } })
    expect(login.statusCode, login.body).toBe(200)
    cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ')
  })

  afterAll(async () => {
    for (const roundId of roundIds) {
      await prisma.partida.deleteMany({ where: { rodadaId: roundId } })
      await prisma.cicloRodada.deleteMany({ where: { rodadaId: roundId } })
      await prisma.permanenciaRodada.deleteMany({ where: { rodadaId: roundId } })
      await prisma.rodada.deleteMany({ where: { id: roundId } })
    }
    if (playerIds.length) await prisma.jogador.deleteMany({ where: { id: { in: playerIds } } })
    await app.close()
    await prisma.$disconnect()
  })

  async function prepareRound(total: number, label: string) {
    const suffix = `${Date.now()}-${label}`
    const round = await app.inject({ method: 'POST', url: '/api/admin/rodadas', headers: { cookie }, payload: { data: `2099-10-${String(roundIds.length + 1).padStart(2, '0')}` } })
    expect(round.statusCode, round.body).toBe(201)
    const roundId = round.json().id as string
    roundIds.push(roundId)
    const participations: string[] = []
    for (let index = 1; index <= total; index++) {
      const created = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Linha Partida ${index} ${suffix}`, apelido: `P${index}-${label}`, telefone: `639${String(roundIds.length).padStart(2, '0')}${String(index).padStart(6, '0')}` } })
      expect(created.statusCode, created.body).toBe(201)
      playerIds.push(created.json().id)
      const added = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/participantes`, headers: { cookie }, payload: { jogadorId: created.json().id, tipo: 'LINHA', confirmado: true, presente: true } })
      expect(added.statusCode, added.body).toBe(201)
      participations.push((added.json() as Json).participacoes.find((item: Json) => item.jogador.id === created.json().id).id)
    }
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/rodadas/${roundId}`, headers: { cookie }, payload: { status: 'PREPARACAO' } })).statusCode).toBe(200)
    for (const participacaoId of participations) {
      const arrival = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/chegadas`, headers: { cookie }, payload: { participacaoId } })
      expect(arrival.statusCode, arrival.body).toBe(200)
    }
    const formed = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/formacao-inicial`, headers: { cookie } })
    expect(formed.statusCode, formed.body).toBe(200)
    return { roundId, state: formed.json() as Json }
  }

  const start = (roundId: string) => app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/partidas/iniciar`, headers: { cookie } })
  const addGoal = (matchId: string, participacaoId: string, lado?: string) => app.inject({ method: 'POST', url: `/api/admin/partidas/${matchId}/gols`, headers: { cookie }, payload: { participacaoId, ...(lado ? { lado } : {}) } })

  it('confirma tabelas, enums, índices e constraints da migration incremental', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('partidas','gols') ORDER BY tablename`
    expect(tables.map((item) => item.tablename)).toEqual(['gols', 'partidas'])
    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`SELECT typname FROM pg_type WHERE typname IN ('StatusPartida','ResultadoPartida') ORDER BY typname`
    expect(enums).toHaveLength(2)
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname IN ('partidas_rodada_em_andamento_key','gols_partida_id_ordem_evento_key')`
    expect(indexes).toHaveLength(2)
  })

  it('executa 16 jogadores, gols, correção, vitória, clique duplo, empate e área pública', async () => {
    const { roundId } = await prepareRound(16, 'flow')
    const firstResponse = await start(roundId)
    expect(firstResponse.statusCode, firstResponse.body).toBe(201)
    const first = firstResponse.json() as Json
    expect(first).toMatchObject({ numero: 1, timePermanente: 'TIME_1', timeEntrante: 'TIME_2', placarTime1: 0, placarTime2: 0 })

    const firstGoal = await addGoal(first.id, first.time1[0].participacaoId, 'TIME_1')
    expect(firstGoal.statusCode, firstGoal.body).toBe(201)
    const wrongTeam = await addGoal(first.id, first.time1[0].participacaoId, 'TIME_2')
    expect(wrongTeam.json().error).toBe('JOGADOR_TIME_INCORRETO')
    const queued = await addGoal(first.id, first.fila[0].participacaoId)
    expect(queued.json().error).toBe('JOGADOR_NAO_ESCALADO')
    const corrected = await app.inject({ method: 'PATCH', url: `/api/admin/gols/${firstGoal.json().gols[0].id}`, headers: { cookie }, payload: { participacaoId: first.time1[1].participacaoId } })
    expect(corrected.json().gols[0].participacaoId).toBe(first.time1[1].participacaoId)
    const secondGoal = await addGoal(first.id, first.time1[1].participacaoId)
    await addGoal(first.id, first.time2[0].participacaoId)
    const deleted = await app.inject({ method: 'DELETE', url: `/api/admin/gols/${secondGoal.json().gols.at(-1).id}`, headers: { cookie } })
    expect(deleted.json()).toMatchObject({ placarTime1: 1, placarTime2: 1 })
    const restored = await addGoal(first.id, first.time1[2].participacaoId)
    expect(restored.json()).toMatchObject({ placarTime1: 2, placarTime2: 1 })

    const finishes = await Promise.all([
      app.inject({ method: 'POST', url: `/api/admin/partidas/${first.id}/finalizar`, headers: { cookie } }),
      app.inject({ method: 'POST', url: `/api/admin/partidas/${first.id}/finalizar`, headers: { cookie } }),
    ])
    expect(finishes.map((response) => response.statusCode).sort()).toEqual([200, 409])
    const finished = finishes.find((response) => response.statusCode === 200)!.json() as Json
    expect(finished).toMatchObject({ resultado: 'TIME_1', timeVencedor: 'TIME_1', timeSaiu: 'TIME_2' })
    expect(await prisma.cicloRodada.count({ where: { rodadaId: roundId } })).toBe(2)
    expect(await prisma.partida.count({ where: { rodadaId: roundId, status: 'FINALIZADA' } })).toBe(1)

    const secondResponse = await start(roundId)
    expect(secondResponse.statusCode, secondResponse.body).toBe(201)
    const second = secondResponse.json() as Json
    expect(second).toMatchObject({ numero: 2, timePermanente: 'TIME_1', timeEntrante: 'TIME_2' })
    await addGoal(second.id, second.time1[0].participacaoId)
    await addGoal(second.id, second.time2[0].participacaoId)
    const publicRound = await app.inject({ method: 'GET', url: `/api/public/rodadas/${roundId}` })
    expect(publicRound.statusCode, publicRound.body).toBe(200)
    expect(publicRound.json().partidaAtual).toMatchObject({ id: second.id, placarTime1: 1, placarTime2: 1 })
    for (const privateField of ['telefone', 'pagamento', 'updatedBy', 'senhaHash', 'auditoria']) expect(publicRound.body).not.toContain(privateField)

    const tie = await app.inject({ method: 'POST', url: `/api/admin/partidas/${second.id}/finalizar`, headers: { cookie } })
    expect(tie.statusCode, tie.body).toBe(200)
    expect(tie.json()).toMatchObject({ resultado: 'EMPATE', timeVencedor: null, timeSaiu: 'TIME_2', timePermanente: 'TIME_1' })
    expect(await prisma.cicloRodada.count({ where: { rodadaId: roundId } })).toBe(3)
    const audit = await prisma.auditoriaJogo.findMany({ where: { rodadaId: roundId }, select: { acao: true } })
    for (const action of ['PARTIDA_INICIADA', 'GOL_CRIADO', 'GOL_CORRIGIDO', 'GOL_REMOVIDO', 'RODIZIO_PARTIDA', 'PARTIDA_FINALIZADA']) expect(audit.some((item) => item.acao === action)).toBe(true)
  }, 60_000)

  it('com 20 jogadores usa seis da fila e mantém os excedentes na frente após empate', async () => {
    const { roundId, state } = await prepareRound(20, 'twenty')
    const oldQueue = state.fila.map((item: Json) => item.participacaoId)
    expect(oldQueue).toHaveLength(8)
    const response = await start(roundId)
    const match = response.json() as Json
    const finished = await app.inject({ method: 'POST', url: `/api/admin/partidas/${match.id}/finalizar`, headers: { cookie } })
    expect(finished.statusCode, finished.body).toBe(200)
    expect(finished.json()).toMatchObject({ placarTime1: 0, placarTime2: 0, resultado: 'EMPATE', timeSaiu: 'TIME_2' })
    const next = (await app.inject({ method: 'GET', url: `/api/admin/rodadas/${roundId}/estado-jogo`, headers: { cookie } })).json() as Json
    expect(next.time1.map((item: Json) => item.participacaoId)).toEqual(match.time1.map((item: Json) => item.participacaoId))
    expect(next.time2.map((item: Json) => item.participacaoId)).toEqual(oldQueue.slice(0, 6))
    expect(next.fila.slice(0, 2).map((item: Json) => item.participacaoId)).toEqual(oldQueue.slice(6))
    expect(next.fila).toHaveLength(8)
  }, 60_000)

  it('faz rollback integral se o estado do rodízio estiver inconsistente', async () => {
    const { roundId } = await prepareRound(16, 'rollback')
    const started = await start(roundId)
    const match = started.json() as Json
    await prisma.escalacaoCiclo.delete({ where: { cicloId_participacaoId: { cicloId: match.cicloId, participacaoId: match.time2[0].participacaoId } } })
    const failed = await app.inject({ method: 'POST', url: `/api/admin/partidas/${match.id}/finalizar`, headers: { cookie } })
    expect(failed.statusCode).toBe(409)
    expect(failed.json().error).toBe('ESTADO_JOGO_INVALIDO')
    expect(await prisma.partida.findUnique({ where: { id: match.id }, select: { status: true, resultado: true, encerradaEm: true } })).toEqual({ status: 'EM_ANDAMENTO', resultado: null, encerradaEm: null })
    expect(await prisma.cicloRodada.count({ where: { rodadaId: roundId } })).toBe(1)
  }, 60_000)
})
