import { LadoEquipe } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/errors.js'
import type { MatchRecord, MatchRepository } from './partida.repository.js'

const goalSchema = z.object({ participacaoId: z.string().uuid('Identificador inválido'), lado: z.nativeEnum(LadoEquipe).optional() })
const playerDto = (player: MatchRecord['team1'][number]) => ({ participacaoId: player.participationId, nome: player.name, apelido: player.nickname, lado: player.side })
export const matchDto = (match: MatchRecord) => ({
  id: match.id, rodadaId: match.roundId, cicloId: match.cycleId, ciclo: match.cycle, numero: match.number,
  status: match.status, timePermanente: match.permanent, timeEntrante: match.entrant,
  placarTime1: match.score1, placarTime2: match.score2, resultado: match.result, timeVencedor: match.winner, timeSaiu: match.leaving,
  iniciadaEm: match.startedAt.toISOString(), encerradaEm: match.endedAt?.toISOString() ?? null,
  time1: match.team1.map(playerDto), time2: match.team2.map(playerDto), fila: match.queue.map(playerDto),
  gols: match.goals.map((goal) => ({ id: goal.id, participacaoId: goal.participationId, nome: goal.playerName, apelido: goal.playerNickname, lado: goal.side, ordem: goal.order, createdAt: goal.createdAt.toISOString(), updatedAt: goal.updatedAt.toISOString() })),
})

export class MatchService {
  constructor(private readonly matches: MatchRepository) {}
  async list(roundId: string) { return (await this.matches.list(roundId)).map(matchDto) }
  async find(id: string) { const match = await this.matches.findById(id); if (!match) throw new AppError(404, 'NOT_FOUND', 'Partida não encontrada'); return matchDto(match) }
  async current(roundId: string) { const match = await this.matches.current(roundId); return match ? matchDto(match) : null }
  async start(roundId: string, adminId: string) { return matchDto(await this.matches.start(roundId, adminId)) }
  async addGoal(matchId: string, input: unknown, adminId: string) { const data = goalSchema.parse(input); return matchDto(await this.matches.addGoal(matchId, { participationId: data.participacaoId, side: data.lado as LadoEquipe | undefined }, adminId)) }
  async updateGoal(goalId: string, input: unknown, adminId: string) { const data = goalSchema.parse(input); return matchDto(await this.matches.updateGoal(goalId, { participationId: data.participacaoId, side: data.lado as LadoEquipe | undefined }, adminId)) }
  async removeGoal(goalId: string, adminId: string) { return matchDto(await this.matches.removeGoal(goalId, adminId)) }
  async finish(matchId: string, adminId: string) { return matchDto(await this.matches.finish(matchId, adminId)) }
}
