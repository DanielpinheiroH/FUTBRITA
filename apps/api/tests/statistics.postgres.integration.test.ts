import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from '../src/app.js'

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true'
type Json = Record<string, any>

describe.skipIf(!enabled)('Etapa 5 no PostgreSQL real', () => {
  let app: FastifyInstance; let prisma: PrismaClient; let cookie = ''; let roundId = ''; const playerIds: string[] = []; const participations: string[] = []
  beforeAll(async () => { prisma = new PrismaClient(); await prisma.$connect(); app = await buildApp({ SESSION_SECRET: process.env.SESSION_SECRET!, NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, createPrismaDependencies(prisma)); const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: process.env.INTEGRATION_ADMIN_EMAIL, senha: process.env.INTEGRATION_ADMIN_PASSWORD } }); expect(login.statusCode, login.body).toBe(200); cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ') })
  afterAll(async () => { if (roundId) { await prisma.partida.deleteMany({ where: { rodadaId: roundId } }); await prisma.cicloRodada.deleteMany({ where: { rodadaId: roundId } }); await prisma.permanenciaRodada.deleteMany({ where: { rodadaId: roundId } }); await prisma.rodada.deleteMany({ where: { id: roundId } }) } if (playerIds.length) await prisma.jogador.deleteMany({ where: { id: { in: playerIds } } }); await app.close(); await prisma.$disconnect() })

  it('confirma a migration incremental de índices', async () => { const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname IN ('rodadas_status_data_idx','participacoes_rodada_jogador_id_idx','escalacoes_ciclo_participacao_id_idx') ORDER BY indexname`; expect(indexes).toHaveLength(3) })

  it('executa partidas reais e deriva perfil, rankings, histórico, temporadas e privacidade', async () => {
    const suffix = Date.now().toString(); const round = await app.inject({ method: 'POST', url: '/api/admin/rodadas', headers: { cookie }, payload: { data: '2099-12-01' } }); expect(round.statusCode, round.body).toBe(201); roundId = round.json().id
    for (let index = 1; index <= 16; index++) { const created = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Estatística Real ${index} ${suffix}`, apelido: index === 1 ? `Artilheiro-${suffix}` : `S${index}-${suffix}`, telefone: `659${String(index).padStart(8, '0')}` } }); expect(created.statusCode, created.body).toBe(201); playerIds.push(created.json().id); const added = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/participantes`, headers: { cookie }, payload: { jogadorId: created.json().id, tipo: 'LINHA', confirmado: true, presente: true } }); expect(added.statusCode, added.body).toBe(201); participations.push((added.json() as Json).participacoes.find((item: Json) => item.jogador.id === created.json().id).id) }
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/rodadas/${roundId}`, headers: { cookie }, payload: { status: 'PREPARACAO' } })).statusCode).toBe(200)
    for (const participacaoId of participations) expect((await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/chegadas`, headers: { cookie }, payload: { participacaoId } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/formacao-inicial`, headers: { cookie } })).statusCode).toBe(200)

    const start = async () => { const response = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/partidas/iniciar`, headers: { cookie } }); expect(response.statusCode, response.body).toBe(201); return response.json() as Json }
    const goal = async (match: Json, participationId: string) => { const response = await app.inject({ method: 'POST', url: `/api/admin/partidas/${match.id}/gols`, headers: { cookie }, payload: { participacaoId: participationId } }); expect(response.statusCode, response.body).toBe(201) }
    const finish = async (match: Json) => { const response = await app.inject({ method: 'POST', url: `/api/admin/partidas/${match.id}/finalizar`, headers: { cookie } }); expect(response.statusCode, response.body).toBe(200); return response.json() as Json }

    const first = await start(); expect(first.time1.some((item: Json) => item.participacaoId === participations[0])).toBe(true); await goal(first, participations[0]); await goal(first, participations[0]); await goal(first, first.time2[0].participacaoId); expect(await finish(first)).toMatchObject({ resultado: 'TIME_1' })
    const second = await start(); await goal(second, participations[0]); await goal(second, second.time2[0].participacaoId); expect(await finish(second)).toMatchObject({ resultado: 'EMPATE', timeVencedor: null })
    const third = await start(); await goal(third, third.time2[0].participacaoId); expect(await finish(third)).toMatchObject({ resultado: 'TIME_2' })
    const closed = await app.inject({ method: 'PATCH', url: `/api/admin/rodadas/${roundId}`, headers: { cookie }, payload: { status: 'ENCERRADA' } }); expect(closed.statusCode, closed.body).toBe(200)

    const profile = await app.inject({ method: 'GET', url: `/api/public/jogadores/${playerIds[0]}/estatisticas?season=2099` }); expect(profile.statusCode, profile.body).toBe(200); expect(profile.json()).toMatchObject({ partidas: 3, vitorias: 1, empates: 1, derrotas: 1, gols: 3, mediaGols: 1, pontos: 4, aproveitamento: 44.44, presencas: 1, filtro: { scope: 'season', season: 2099 } }); expect(profile.json().historicoRecente).toHaveLength(1); expect(profile.json().historicoRecente[0].jogos.map((item: Json) => item.desempenho)).toEqual(['VITORIA', 'EMPATE', 'DERROTA'])
    const goals = await app.inject({ method: 'GET', url: '/api/public/rankings?type=goals&season=2099' }); expect(goals.json().itens[0]).toMatchObject({ jogador: { id: playerIds[0] }, gols: 3, partidas: 3 })
    const wins = await app.inject({ method: 'GET', url: '/api/public/rankings?type=wins&roundId=' + roundId }); expect(wins.json().itens.find((item: Json) => item.jogador.id === playerIds[0]).vitorias).toBe(1)
    const rate = await app.inject({ method: 'GET', url: '/api/public/rankings?type=winRate&season=2099' }); expect(rate.json().itens.find((item: Json) => item.jogador.id === playerIds[0]).aproveitamento).toBe(44.44)
    const seasons = await app.inject({ method: 'GET', url: '/api/public/estatisticas/temporadas' }); expect(seasons.json()).toContain(2099)
    const history = await app.inject({ method: 'GET', url: '/api/public/historico' }); expect(history.json().find((item: Json) => item.id === roundId)).toMatchObject({ partidas: 3, gols: 6, participantes: 16 })
    const detail = await app.inject({ method: 'GET', url: `/api/public/historico/${roundId}` }); expect(detail.json().jogos.map((item: Json) => item.numero)).toEqual([1, 2, 3]); expect(detail.json().destaques.artilheiro.jogador.id).toBe(playerIds[0])
    const inactivated = await app.inject({ method: 'PATCH', url: `/api/admin/jogadores/${playerIds[0]}`, headers: { cookie }, payload: { ativo: false } }); expect(inactivated.statusCode).toBe(200); expect((await app.inject({ method: 'GET', url: `/api/public/jogadores/${playerIds[0]}` })).statusCode).toBe(404); expect((await app.inject({ method: 'GET', url: `/api/public/jogadores/${playerIds[0]}/estatisticas?season=2099` })).statusCode).toBe(200)
    for (const response of [profile, goals, wins, rate, history, detail]) for (const privateField of ['telefone', 'pagamento', 'senhaHash', 'updatedBy', 'auditoria']) expect(response.body).not.toContain(privateField)
  }, 90_000)
})
