import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp, type AppDependencies } from '../src/app.js'
import type { StatisticsDataset, StatisticsFilter, StatisticsRepository } from '../src/modules/statistics/statistics.repository.js'
import type { AdminRepository } from '../src/modules/admins/admin.repository.js'
import type { JogadorRepository } from '../src/modules/jogadores/jogador.repository.js'
import { SessionStore } from '../src/modules/auth/session.store.js'
import type { JogadorEntity } from '../src/shared/entities.js'

const ids = { a: '10000000-0000-4000-8000-000000000001', b: '10000000-0000-4000-8000-000000000002', keeper: '10000000-0000-4000-8000-000000000003', r26: '20000000-0000-4000-8000-000000000001', r27: '20000000-0000-4000-8000-000000000002' }
const players = [{ id: ids.a, nome: 'Daniel Henrique', apelido: 'Daniel', ativo: true }, { id: ids.b, nome: 'Pedro Silva', apelido: 'Pedro', ativo: false }, { id: ids.keeper, nome: 'Goleiro Um', apelido: 'GK', ativo: true }]
const dataset: StatisticsDataset = {
  players,
  matches: [
    { id: 'm1', roundId: ids.r26, date: '2026-08-01', number: 1, result: 'TIME_1', winner: 'TIME_1', score1: 2, score2: 1, lineups: [{ playerId: ids.a, side: 'TIME_1' }, { playerId: ids.b, side: 'TIME_2' }], goals: [{ playerId: ids.a, side: 'TIME_1' }, { playerId: ids.a, side: 'TIME_1' }, { playerId: ids.b, side: 'TIME_2' }] },
    { id: 'm2', roundId: ids.r26, date: '2026-08-01', number: 2, result: 'EMPATE', winner: null, score1: 1, score2: 1, lineups: [{ playerId: ids.a, side: 'TIME_1' }, { playerId: ids.b, side: 'TIME_2' }], goals: [] },
    { id: 'm3', roundId: ids.r27, date: '2027-08-01', number: 1, result: 'TIME_2', winner: 'TIME_2', score1: 0, score2: 1, lineups: [{ playerId: ids.a, side: 'TIME_1' }, { playerId: ids.b, side: 'TIME_2' }], goals: [{ playerId: ids.b, side: 'TIME_2' }] },
  ],
  appearances: [{ playerId: ids.a, roundId: ids.r26, date: '2026-08-01' }, { playerId: ids.b, roundId: ids.r26, date: '2026-08-01' }, { playerId: ids.keeper, roundId: ids.r26, date: '2026-08-01' }],
}
class MemoryStatistics implements StatisticsRepository {
  async dataset(filter?: StatisticsFilter) { return { players, matches: dataset.matches.filter((item) => !filter?.roundId || item.roundId === filter.roundId).filter((item) => !filter?.season || item.date.startsWith(String(filter.season))), appearances: dataset.appearances.filter((item) => !filter?.roundId || item.roundId === filter.roundId).filter((item) => !filter?.season || item.date.startsWith(String(filter.season))) } }
  async availableSeasons() { return [2027, 2026] }
  async roundInfo(roundId: string) { return roundId === ids.r26 ? { id: ids.r26, date: '2026-08-01', status: 'ENCERRADA', participations: [{ playerId: ids.a, type: 'LINHA' as const, present: true }, { playerId: ids.b, type: 'LINHA' as const, present: true }, { playerId: ids.keeper, type: 'GOLEIRO' as const, present: true }] } : null }
  async history() { return [{ id: ids.r26, date: '2026-08-01', participants: 3, linePlayers: 2, goalkeepers: 1, matches: 2, goals: 3 }] }
  async currentRound() { return null }
}
class EmptyAdmins implements AdminRepository { async findByEmail() { return null } async findById() { return null } }
class EmptyPlayers implements JogadorRepository { async list() { return [] } async findById() { return null } async create(): Promise<JogadorEntity> { throw new Error('unused') } async update() { return null } }

describe('Etapa 5 - estatísticas públicas HTTP', () => {
  let app: FastifyInstance
  beforeEach(async () => { const deps: AppDependencies = { admins: new EmptyAdmins(), jogadores: new EmptyPlayers(), sessions: new SessionStore(), databaseCheck: async () => undefined, statistics: new MemoryStatistics() }; app = await buildApp({ SESSION_SECRET: 'segredo-de-testes-com-mais-de-32-caracteres', NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, deps) })
  afterEach(async () => app.close())

  it('filtra perfil por temporada sem misturar anos', async () => { const response = await app.inject({ method: 'GET', url: `/api/public/jogadores/${ids.a}/estatisticas?season=2026` }); expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ partidas: 2, vitorias: 1, empates: 1, derrotas: 0, gols: 2, presencas: 1, filtro: { scope: 'season', season: 2026 } }) })
  it('mantém jogador inativo no histórico e nunca retorna dados privados', async () => { const response = await app.inject({ method: 'GET', url: `/api/public/jogadores/${ids.b}/estatisticas?scope=all` }); expect(response.statusCode).toBe(200); expect(response.json().jogador.ativo).toBe(false); for (const field of ['telefone', 'pagamento', 'senha', 'auditoria', 'updatedBy']) expect(response.body).not.toContain(field) })
  it.each(['goals', 'wins', 'winRate', 'games', 'appearances', 'goalAverage', 'streak'])('publica ranking %s', async (type) => { const response = await app.inject({ method: 'GET', url: `/api/public/rankings?type=${type}&season=2026` }); expect(response.statusCode, response.body).toBe(200); expect(response.json()).toMatchObject({ tipo: type, filtro: { scope: 'season', season: 2026 } }); expect(response.json().itens[0].posicao).toBe(1) })
  it('filtra ranking pela rodada e aceita mínimo de jogos', async () => { const response = await app.inject({ method: 'GET', url: `/api/public/rankings?type=goals&roundId=${ids.r26}&minGames=2` }); expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ minGames: 2, filtro: { scope: 'round', roundId: ids.r26 } }) })
  it('expõe histórico e detalhe cronológico da rodada sem financeiro', async () => { const list = await app.inject({ method: 'GET', url: '/api/public/historico' }); expect(list.json()[0]).toMatchObject({ partidas: 2, gols: 3, goleiros: 1 }); const detail = await app.inject({ method: 'GET', url: `/api/public/historico/${ids.r26}` }); expect(detail.json().jogos.map((item: { numero: number }) => item.numero)).toEqual([1, 2]); expect(detail.body).not.toContain('pagamento') })
  it('não contabiliza goleiro em partidas, gols ou vitórias', async () => { const response = await app.inject({ method: 'GET', url: `/api/public/jogadores/${ids.keeper}/estatisticas?season=2026` }); expect(response.json()).toMatchObject({ partidas: 0, vitorias: 0, empates: 0, derrotas: 0, gols: 0, presencas: 1 }) })
  it('rejeita filtros conflitantes', async () => expect((await app.inject({ method: 'GET', url: `/api/public/rankings?season=2026&roundId=${ids.r26}` })).statusCode).toBe(400))
})
