import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { LadoEquipe, ResultadoPartida, StatusPartida } from '@prisma/client'
import { buildApp, type AppDependencies } from '../src/app.js'
import type { AdminRepository } from '../src/modules/admins/admin.repository.js'
import type { JogadorRepository } from '../src/modules/jogadores/jogador.repository.js'
import { SessionStore } from '../src/modules/auth/session.store.js'
import type { AdminEntity, JogadorEntity } from '../src/shared/entities.js'
import { AppError } from '../src/shared/errors.js'
import type { GoalInput, MatchRecord, MatchRepository } from '../src/modules/partidas/partida.repository.js'
import { resolveMatch } from '../src/domain/matches/match-rules.js'

class MemoryAdmins implements AdminRepository { constructor(private data: AdminEntity[]) {} async findByEmail(email: string) { return this.data.find((item) => item.email === email) ?? null } async findById(id: string) { return this.data.find((item) => item.id === id) ?? null } }
class MemoryPlayers implements JogadorRepository { async list() { return [] } async findById() { return null } async create(): Promise<JogadorEntity> { throw new Error('unused') } async update() { return null } }
const player = (index: number, side: LadoEquipe) => ({ participationId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, name: `Jogador ${index}`, nickname: `J${index}`, side })
class MemoryMatches implements MatchRepository {
  match: MatchRecord | null = null
  async list() { return this.match ? [this.match] : [] }
  async findById(id: string) { return this.match?.id === id ? this.match : null }
  async current() { return this.match?.status === StatusPartida.EM_ANDAMENTO ? this.match : null }
  async start(roundId: string) { if (this.match?.status === StatusPartida.EM_ANDAMENTO) throw new AppError(409, 'PARTIDA_EM_ANDAMENTO_EXISTENTE', 'Já existe'); const now = new Date(); this.match = { id: randomUUID(), roundId, cycleId: randomUUID(), cycle: 1, number: 1, status: StatusPartida.EM_ANDAMENTO, permanent: LadoEquipe.TIME_1, entrant: LadoEquipe.TIME_2, score1: 0, score2: 0, result: null, winner: null, leaving: null, startedAt: now, endedAt: null, team1: Array.from({ length: 6 }, (_, i) => player(i + 1, LadoEquipe.TIME_1)), team2: Array.from({ length: 6 }, (_, i) => player(i + 7, LadoEquipe.TIME_2)), queue: Array.from({ length: 4 }, (_, i) => player(i + 13, LadoEquipe.TIME_1)), goals: [] }; return this.match }
  async addGoal(id: string, input: GoalInput) { const match = this.need(id); this.active(match); const selected = [...match.team1, ...match.team2].find((item) => item.participationId === input.participationId); if (!selected) throw new AppError(409, 'JOGADOR_NAO_ESCALADO', 'Não escalado'); if (input.side && input.side !== selected.side) throw new AppError(409, 'JOGADOR_TIME_INCORRETO', 'Time incorreto'); const now = new Date(); match.goals.push({ id: randomUUID(), participationId: selected.participationId, playerName: selected.name, playerNickname: selected.nickname, side: selected.side, order: match.goals.length + 1, createdAt: now, updatedAt: now }); this.score(match); return match }
  async updateGoal(id: string, input: GoalInput) { const match = this.match!; this.active(match); const goal = match.goals.find((item) => item.id === id); if (!goal) throw new AppError(404, 'NOT_FOUND', 'Gol não encontrado'); const selected = [...match.team1, ...match.team2].find((item) => item.participationId === input.participationId); if (!selected) throw new AppError(409, 'JOGADOR_NAO_ESCALADO', 'Não escalado'); if (input.side && input.side !== selected.side) throw new AppError(409, 'JOGADOR_TIME_INCORRETO', 'Time incorreto'); Object.assign(goal, { participationId: selected.participationId, playerName: selected.name, playerNickname: selected.nickname, side: selected.side, updatedAt: new Date() }); this.score(match); return match }
  async removeGoal(id: string) { const match = this.match!; this.active(match); match.goals = match.goals.filter((item) => item.id !== id); this.score(match); return match }
  async finish(id: string) { const match = this.need(id); this.active(match); const result = resolveMatch(match.score1, match.score2, match.permanent, match.entrant); match.status = StatusPartida.FINALIZADA; match.result = result.result as ResultadoPartida; match.winner = result.winner as LadoEquipe | null; match.leaving = result.leaving as LadoEquipe; match.endedAt = new Date(); return match }
  private need(id: string) { if (!this.match || this.match.id !== id) throw new AppError(404, 'NOT_FOUND', 'Partida não encontrada'); return this.match }
  private active(match: MatchRecord) { if (match.status === StatusPartida.FINALIZADA) throw new AppError(409, 'PARTIDA_JA_FINALIZADA', 'Finalizada') }
  private score(match: MatchRecord) { match.score1 = match.goals.filter((goal) => goal.side === LadoEquipe.TIME_1).length; match.score2 = match.goals.filter((goal) => goal.side === LadoEquipe.TIME_2).length }
}

describe('Etapa 4 - partidas e gols HTTP', () => {
  let app: FastifyInstance; let matches: MemoryMatches; let cookie = ''; const roundId = '10000000-0000-4000-8000-000000000001'
  beforeEach(async () => { matches = new MemoryMatches(); const admins = new MemoryAdmins([{ id: randomUUID(), nome: 'Admin', email: 'admin@futbrita.test', senhaHash: await bcrypt.hash('Senha123!', 4), ativo: true }]); const deps: AppDependencies = { admins, jogadores: new MemoryPlayers(), matches, sessions: new SessionStore(), databaseCheck: async () => undefined }; app = await buildApp({ SESSION_SECRET: 'segredo-de-testes-com-mais-de-32-caracteres', NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, deps); const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: 'Senha123!' } }); cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ') })
  afterEach(async () => app.close())
  const start = () => app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/partidas/iniciar`, headers: { cookie } })
  const goal = (matchId: string, participacaoId: string, lado?: string) => app.inject({ method: 'POST', url: `/api/admin/partidas/${matchId}/gols`, headers: { cookie }, payload: { participacaoId, ...(lado ? { lado } : {}) } })

  it('protege início sem autenticação', async () => expect((await app.inject({ method: 'POST', url: `/api/admin/rodadas/${roundId}/partidas/iniciar` })).statusCode).toBe(401))
  it('inicia uma única partida com vantagem inicial do Time 1', async () => { const created = await start(); expect(created.statusCode).toBe(201); expect(created.json()).toMatchObject({ numero: 1, status: 'EM_ANDAMENTO', timePermanente: 'TIME_1', timeEntrante: 'TIME_2', placarTime1: 0, placarTime2: 0 }); expect((await start()).json().error).toBe('PARTIDA_EM_ANDAMENTO_EXISTENTE') })
  it('registra gols dos dois times e deriva o placar', async () => { const match = (await start()).json(); await goal(match.id, match.time1[0].participacaoId); await goal(match.id, match.time1[0].participacaoId); const response = await goal(match.id, match.time2[0].participacaoId); expect(response.json()).toMatchObject({ placarTime1: 2, placarTime2: 1 }); expect(response.json().gols).toHaveLength(3) })
  it('impede jogador da fila e lado incorreto', async () => { const match = (await start()).json(); expect((await goal(match.id, match.fila[0].participacaoId)).json().error).toBe('JOGADOR_NAO_ESCALADO'); expect((await goal(match.id, match.time1[0].participacaoId, 'TIME_2')).json().error).toBe('JOGADOR_TIME_INCORRETO') })
  it('corrige autor e recalcula o lado do gol', async () => { const match = (await start()).json(); const added = await goal(match.id, match.time1[0].participacaoId); const corrected = await app.inject({ method: 'PATCH', url: `/api/admin/gols/${added.json().gols[0].id}`, headers: { cookie }, payload: { participacaoId: match.time2[1].participacaoId } }); expect(corrected.json()).toMatchObject({ placarTime1: 0, placarTime2: 1, gols: [{ apelido: 'J8', lado: 'TIME_2' }] }) })
  it('exclui gol e deriva o placar novamente', async () => { const match = (await start()).json(); const added = await goal(match.id, match.time1[0].participacaoId); const removed = await app.inject({ method: 'DELETE', url: `/api/admin/gols/${added.json().gols[0].id}`, headers: { cookie } }); expect(removed.json()).toMatchObject({ placarTime1: 0, placarTime2: 0, gols: [] }) })
  it('finaliza 0 a 0 como empate, mantém permanente e bloqueia novos gols', async () => { const match = (await start()).json(); const finished = await app.inject({ method: 'POST', url: `/api/admin/partidas/${match.id}/finalizar`, headers: { cookie } }); expect(finished.json()).toMatchObject({ resultado: 'EMPATE', timeVencedor: null, timeSaiu: 'TIME_2' }); expect((await goal(match.id, match.time1[0].participacaoId)).json().error).toBe('PARTIDA_JA_FINALIZADA') })
  it('lista histórico e detalhe', async () => { const match = (await start()).json(); expect((await app.inject({ method: 'GET', url: `/api/admin/rodadas/${roundId}/partidas`, headers: { cookie } })).json()).toHaveLength(1); expect((await app.inject({ method: 'GET', url: `/api/admin/partidas/${match.id}`, headers: { cookie } })).json().id).toBe(match.id) })
})
