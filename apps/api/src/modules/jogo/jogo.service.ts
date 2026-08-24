import { LadoEquipe } from '@prisma/client'
import { z } from 'zod'
import type { GameRepository, GameStateRecord } from './jogo.repository.js'

const uuid = z.string().uuid('Identificador inválido')
export const gameStateDto = (state: GameStateRecord | null) => state ? {
  rodadaId: state.roundId, ciclo: state.cycle, versao: state.version,
  time1: state.team1.map(publicPlayer), time2: state.team2.map(publicPlayer), fila: state.queue.map(publicPlayer),
  completo: state.team1.length === 6 && state.team2.length === 6,
} : null
const publicPlayer = (player: GameStateRecord['team1'][number]) => ({ participacaoId: player.participationId, nome: player.name, apelido: player.nickname, ordemChegada: player.arrivalOrder })

export class GameService {
  constructor(private readonly games: GameRepository) {}
  async arrivals(roundId: string) { return (await this.games.arrivals(roundId)).map((item) => ({ ...publicPlayer(item), chegouEm: item.arrivedAt.toISOString() })) }
  async state(roundId: string) { return gameStateDto(await this.games.state(roundId)) }
  async register(roundId: string, input: unknown, adminId: string) { const body = z.object({ participacaoId: uuid }).parse(input); await this.games.registerArrival(roundId, body.participacaoId, adminId); return this.arrivals(roundId) }
  async reorder(roundId: string, input: unknown, adminId: string) { const body = z.object({ participacaoIds: z.array(uuid).min(1) }).parse(input); return (await this.games.reorder(roundId, body.participacaoIds, adminId)).map((item) => ({ ...publicPlayer(item), chegouEm: item.arrivedAt.toISOString() })) }
  async remove(roundId: string, participationId: string, adminId: string) { return (await this.games.removeArrival(roundId, participationId, adminId)).map((item) => ({ ...publicPlayer(item), chegouEm: item.arrivedAt.toISOString() })) }
  async form(roundId: string, adminId: string) { return gameStateDto(await this.games.formInitial(roundId, adminId)) }
  async rotate(roundId: string, input: unknown, adminId: string) { const body = z.object({ timeSaiu: z.nativeEnum(LadoEquipe) }).parse(input); return gameStateDto(await this.games.rotate(roundId, body.timeSaiu, adminId)) }
  async exit(participationId: string, adminId: string) { return gameStateDto(await this.games.markExit(participationId, adminId)) }
}
