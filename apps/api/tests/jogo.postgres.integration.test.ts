import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from '../src/app.js'

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true'
describe.skipIf(!enabled)('Etapa 3 no PostgreSQL real', () => {
  let app: FastifyInstance; let prisma: PrismaClient; let cookie = ''; let roundId = ''; const playerIds: string[] = []
  beforeAll(async () => { prisma = new PrismaClient(); await prisma.$connect(); app = await buildApp({ SESSION_SECRET: process.env.SESSION_SECRET!, NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, createPrismaDependencies(prisma)); const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: process.env.INTEGRATION_ADMIN_EMAIL, senha: process.env.INTEGRATION_ADMIN_PASSWORD } }); expect(login.statusCode).toBe(200); cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ') })
  afterAll(async () => { if (roundId) { await prisma.cicloRodada.deleteMany({ where: { rodadaId: roundId } }); await prisma.permanenciaRodada.deleteMany({ where: { rodadaId: roundId } }); await prisma.rodada.deleteMany({ where: { id: roundId } }) } const validPlayerIds = playerIds.filter((id): id is string => Boolean(id)); if (validPlayerIds.length) await prisma.jogador.deleteMany({ where: { id: { in: validPlayerIds } } }); await app.close(); await prisma.$disconnect() })

  it('confirma tabelas, colunas e constraints incrementais', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('estados_rodada_jogo','ciclos_rodada','escalacoes_ciclo','filas_ciclo','permanencias_rodada','auditorias_jogo') ORDER BY tablename`
    expect(tables).toHaveLength(6)
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_name='participacoes_rodada' AND column_name IN ('ordem_chegada','chegou_em','saiu_em') ORDER BY column_name`
    expect(columns).toHaveLength(3)
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname IN ('participacoes_rodada_rodada_id_ordem_chegada_key','filas_ciclo_ciclo_id_posicao_key')`
    expect(indexes).toHaveLength(2)
  })

  it('executa fluxo HTTP real de 16 linhas, ciclos, chegada tardia, saída e público', async () => {
    const suffix = Date.now().toString(); const round = await app.inject({ method: 'POST', url: '/api/admin/rodadas', headers: { cookie }, payload: { data: '2099-09-02' } }); expect(round.statusCode).toBe(201); roundId = round.json().id
    const participations: string[] = []
    for (let index = 1; index <= 16; index++) {
      const created = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Linha Motor ${index} ${suffix}`, apelido: `M${index}-${suffix}`, telefone: `619${String(index).padStart(8, '0')}` } }); expect(created.statusCode).toBe(201); playerIds.push(created.json().id)
      const added = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/participantes`, headers: { cookie }, payload: { jogadorId: created.json().id, tipo: 'LINHA', confirmado: true, presente: true } }); expect(added.statusCode).toBe(201); participations.push(added.json().participacoes.find((p: { jogador: { id: string } }) => p.jogador.id === created.json().id).id)
    }
    const goalkeepers: string[] = []
    for (let index = 1; index <= 4; index++) { const created = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Goleiro Motor ${index} ${suffix}`, apelido: `GK${index}-${suffix}`, telefone: `629${String(index).padStart(8, '0')}` } }); expect(created.statusCode, created.body).toBe(201); playerIds.push(created.json().id); const added = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/participantes`, headers: { cookie }, payload: { jogadorId: created.json().id, tipo: 'GOLEIRO', confirmado: true, presente: true } }); expect(added.statusCode, added.body).toBe(201); goalkeepers.push(added.json().participacoes.find((p: { jogador: { id: string } }) => p.jogador.id === created.json().id).id) }
    await app.inject({ method: 'PATCH', url: `/api/admin/rodadas/${roundId}`, headers: { cookie }, payload: { status: 'PREPARACAO' } })
    const keeperDenied = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/chegadas`, headers: { cookie }, payload: { participacaoId: goalkeepers[0] } }); expect(keeperDenied.statusCode).toBe(409); expect(keeperDenied.json().error).toBe('JOGADOR_NAO_E_LINHA')
    for (let index = 0; index < participations.length; index++) { const arrival = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/chegadas`, headers: { cookie }, payload: { participacaoId: participations[index] } }); expect(arrival.statusCode, arrival.body).toBe(200); if (index === 10) { const insufficient = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/formacao-inicial`, headers: { cookie } }); expect(insufficient.statusCode).toBe(409); expect(insufficient.json().error).toBe('JOGADORES_INSUFICIENTES') } }
    const reordered = [participations[1], participations[0], ...participations.slice(2)]; const corrected = await app.inject({ method: 'PUT', url: `/api/admin/rodadas/${roundId}/chegadas/reordenar`, headers: { cookie }, payload: { participacaoIds: reordered } }); expect(corrected.json().map((p: { ordemChegada: number }) => p.ordemChegada)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1)); await app.inject({ method: 'PUT', url: `/api/admin/rodadas/${roundId}/chegadas/reordenar`, headers: { cookie }, payload: { participacaoIds: participations } })
    const formed = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/formacao-inicial`, headers: { cookie } }); expect(formed.statusCode).toBe(200); expect(formed.json().time1.map((p: { ordemChegada: number }) => p.ordemChegada)).toEqual([1, 3, 5, 7, 9, 11]); expect(formed.json().time2.map((p: { ordemChegada: number }) => p.ordemChegada)).toEqual([2, 4, 6, 8, 10, 12]); expect(formed.json().fila).toHaveLength(4)
    const rotated = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/rodizio`, headers: { cookie }, payload: { timeSaiu: 'TIME_1' } }); expect(rotated.statusCode).toBe(200); expect(rotated.json()).toMatchObject({ ciclo: 2, completo: true }); expect(rotated.json().fila).toHaveLength(4)
    for (let cycle = 0; cycle < 3; cycle++) { const response = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/rodizio`, headers: { cookie }, payload: { timeSaiu: cycle % 2 ? 'TIME_1' : 'TIME_2' } }); expect(response.statusCode).toBe(200) }
    const latePlayer = await app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: { nome: `Atrasado ${suffix}`, apelido: `Late-${suffix}`, telefone: '61977776666' } }); playerIds.push(latePlayer.json().id)
    const lateAdded = await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/participantes`, headers: { cookie }, payload: { jogadorId: latePlayer.json().id, tipo: 'LINHA', confirmado: true, presente: true } }); const lateParticipation = lateAdded.json().participacoes.find((p: { jogador: { id: string } }) => p.jogador.id === latePlayer.json().id)
    await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/chegadas`, headers: { cookie }, payload: { participacaoId: lateParticipation.id } }); const withLate = await app.inject({ method: 'GET', url: `/api/admin/rodadas/${roundId}/estado-jogo`, headers: { cookie } }); expect(withLate.json().fila.at(-1).participacaoId).toBe(lateParticipation.id)
    const exitId = withLate.json().fila[0].participacaoId; const exited = await app.inject({ method: 'PATCH', url: `/api/admin/participacoes/${exitId}/saida`, headers: { cookie } }); expect(exited.statusCode).toBe(200); expect(exited.json().fila.some((p: { participacaoId: string }) => p.participacaoId === exitId)).toBe(false)
    const publicRound = await app.inject({ method: 'GET', url: '/api/public/rodadas/atual' }); expect(publicRound.statusCode).toBe(200); expect(publicRound.json().estadoJogo).toBeTruthy(); for (const privateField of ['telefone', 'pagamento', 'permanencia', 'updatedBy']) expect(publicRound.body).not.toContain(privateField)
  }, 30_000)
})
