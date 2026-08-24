import { PrismaClient, StatusPartida, StatusRodada, TipoParticipacao } from '@prisma/client'
import type { StatisticAppearance, StatisticMatch, StatisticPlayer } from '../../domain/statistics/statistics-engine.js'

export interface StatisticsFilter { season?: number; roundId?: string }
export interface StatisticsDataset { players: StatisticPlayer[]; matches: StatisticMatch[]; appearances: StatisticAppearance[] }
export interface StatisticsRoundInfo {
  id: string; date: string; status: string
  participations: Array<{ playerId: string; type: 'LINHA' | 'GOLEIRO'; present: boolean }>
}
export interface HistoryRoundRecord { id: string; date: string; participants: number; linePlayers: number; goalkeepers: number; matches: number; goals: number }
export interface CurrentRoundRecord { id: string; date: string; participants: number }
export interface StatisticsRepository {
  dataset(filter?: StatisticsFilter): Promise<StatisticsDataset>
  availableSeasons(playerId?: string): Promise<number[]>
  roundInfo(roundId: string): Promise<StatisticsRoundInfo | null>
  history(): Promise<HistoryRoundRecord[]>
  currentRound(): Promise<CurrentRoundRecord | null>
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
const roundWhere = (filter?: StatisticsFilter) => filter?.roundId ? { id: filter.roundId } : filter?.season ? { data: { gte: new Date(`${filter.season}-01-01T00:00:00.000Z`), lt: new Date(`${filter.season + 1}-01-01T00:00:00.000Z`) } } : {}

export class PrismaStatisticsRepository implements StatisticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async dataset(filter?: StatisticsFilter): Promise<StatisticsDataset> {
    const rodada = roundWhere(filter)
    const [players, matches, appearances] = await Promise.all([
      this.prisma.jogador.findMany({ select: { id: true, nome: true, apelido: true, ativo: true } }),
      this.prisma.partida.findMany({
        where: { status: StatusPartida.FINALIZADA, rodada },
        include: {
          rodada: { select: { data: true } },
          ciclo: { include: { escalacoes: { where: { participacao: { tipo: TipoParticipacao.LINHA } }, include: { participacao: { select: { jogadorId: true } } } } } },
          gols: { include: { participacao: { select: { jogadorId: true } } }, orderBy: { ordemEvento: 'asc' } },
        },
        orderBy: [{ rodada: { data: 'asc' } }, { numero: 'asc' }],
      }),
      this.prisma.participacaoRodada.findMany({
        where: { presente: true, rodada: { ...rodada, status: StatusRodada.ENCERRADA } },
        select: { jogadorId: true, rodadaId: true, rodada: { select: { data: true } } },
      }),
    ])
    return {
      players,
      matches: matches.map((match) => ({ id: match.id, roundId: match.rodadaId, date: dateOnly(match.rodada.data), number: match.numero, result: match.resultado!, winner: match.timeVencedor, score1: match.placarTime1, score2: match.placarTime2, lineups: match.ciclo.escalacoes.map((lineup) => ({ playerId: lineup.participacao.jogadorId, side: lineup.lado })), goals: match.gols.map((goal) => ({ id: goal.id, playerId: goal.participacao.jogadorId, side: goal.lado, order: goal.ordemEvento, createdAt: goal.createdAt.toISOString() })) })),
      appearances: appearances.map((item) => ({ playerId: item.jogadorId, roundId: item.rodadaId, date: dateOnly(item.rodada.data) })),
    }
  }

  async availableSeasons(playerId?: string) {
    const [matches, appearances] = await Promise.all([
      this.prisma.partida.findMany({ where: { status: StatusPartida.FINALIZADA, ...(playerId ? { ciclo: { escalacoes: { some: { participacao: { jogadorId: playerId } } } } } : {}) }, select: { rodada: { select: { data: true } } }, distinct: ['rodadaId'] }),
      this.prisma.participacaoRodada.findMany({ where: { presente: true, rodada: { status: StatusRodada.ENCERRADA }, ...(playerId ? { jogadorId: playerId } : {}) }, select: { rodada: { select: { data: true } } }, distinct: ['rodadaId'] }),
    ])
    return [...new Set([...matches, ...appearances].map((item) => item.rodada.data.getUTCFullYear()))].sort((a, b) => b - a)
  }

  async roundInfo(roundId: string) {
    const round = await this.prisma.rodada.findUnique({ where: { id: roundId }, select: { id: true, data: true, status: true, participacoes: { select: { jogadorId: true, tipo: true, presente: true } } } })
    return round ? { id: round.id, date: dateOnly(round.data), status: round.status, participations: round.participacoes.map((item) => ({ playerId: item.jogadorId, type: item.tipo, present: item.presente })) } : null
  }

  async history() {
    const rounds = await this.prisma.rodada.findMany({ where: { status: StatusRodada.ENCERRADA }, select: { id: true, data: true, participacoes: { select: { presente: true, tipo: true } }, partidas: { where: { status: StatusPartida.FINALIZADA }, select: { gols: { select: { id: true } } } } }, orderBy: { data: 'desc' } })
    return rounds.map((round) => ({ id: round.id, date: dateOnly(round.data), participants: round.participacoes.filter((item) => item.presente).length, linePlayers: round.participacoes.filter((item) => item.presente && item.tipo === TipoParticipacao.LINHA).length, goalkeepers: round.participacoes.filter((item) => item.presente && item.tipo === TipoParticipacao.GOLEIRO).length, matches: round.partidas.length, goals: round.partidas.reduce((total, match) => total + match.gols.length, 0) }))
  }

  async currentRound() {
    const round = await this.prisma.rodada.findFirst({ where: { status: { in: [StatusRodada.PLANEJADA, StatusRodada.PREPARACAO, StatusRodada.EM_ANDAMENTO] } }, select: { id: true, data: true, participacoes: { where: { presente: true }, select: { id: true } } }, orderBy: [{ data: 'asc' }, { horario: 'asc' }] })
    return round ? { id: round.id, date: dateOnly(round.data), participants: round.participacoes.length } : null
  }
}
