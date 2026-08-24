import { LadoEquipe, Prisma, PrismaClient, ResultadoPartida, StatusPartida, StatusRodada, TipoParticipacao } from '@prisma/client'
import { resolveMatch, type TeamSide } from '../../domain/matches/match-rules.js'
import { AppError } from '../../shared/errors.js'
import { lockRound, rotateRoundInTransaction } from '../jogo/jogo.repository.js'

export interface MatchPlayerRecord { participationId: string; name: string; nickname: string; side: LadoEquipe }
export interface GoalRecord { id: string; participationId: string; playerName: string; playerNickname: string; side: LadoEquipe; order: number; createdAt: Date; updatedAt: Date }
export interface MatchRecord {
  id: string; roundId: string; cycleId: string; cycle: number; number: number; status: StatusPartida
  permanent: LadoEquipe; entrant: LadoEquipe; score1: number; score2: number; result: ResultadoPartida | null
  winner: LadoEquipe | null; leaving: LadoEquipe | null; startedAt: Date; endedAt: Date | null
  team1: MatchPlayerRecord[]; team2: MatchPlayerRecord[]; queue: MatchPlayerRecord[]; goals: GoalRecord[]
}
export interface GoalInput { participationId: string; side?: LadoEquipe }
export interface MatchRepository {
  list(roundId: string): Promise<MatchRecord[]>
  findById(id: string): Promise<MatchRecord | null>
  current(roundId: string): Promise<MatchRecord | null>
  start(roundId: string, adminId: string): Promise<MatchRecord>
  addGoal(matchId: string, input: GoalInput, adminId: string): Promise<MatchRecord>
  updateGoal(goalId: string, input: GoalInput, adminId: string): Promise<MatchRecord>
  removeGoal(goalId: string, adminId: string): Promise<MatchRecord>
  finish(matchId: string, adminId: string): Promise<MatchRecord>
}

const matchInclude = {
  ciclo: {
    include: {
      escalacoes: { include: { participacao: { include: { jogador: true } } }, orderBy: { participacao: { ordemChegada: 'asc' as const } } },
      fila: { include: { participacao: { include: { jogador: true } } }, orderBy: { posicao: 'asc' as const } },
    },
  },
  gols: { include: { participacao: { include: { jogador: true } } }, orderBy: { ordemEvento: 'asc' as const } },
} satisfies Prisma.PartidaInclude
type PrismaMatch = Prisma.PartidaGetPayload<{ include: typeof matchInclude }>

const lineupPlayer = (item: PrismaMatch['ciclo']['escalacoes'][number]): MatchPlayerRecord => ({ participationId: item.participacaoId, name: item.participacao.jogador.nome, nickname: item.participacao.jogador.apelido, side: item.lado })
function mapMatch(match: PrismaMatch): MatchRecord {
  return {
    id: match.id, roundId: match.rodadaId, cycleId: match.cicloId, cycle: match.ciclo.numero, number: match.numero,
    status: match.status, permanent: match.timePermanente, entrant: match.timeEntrante,
    score1: match.placarTime1, score2: match.placarTime2, result: match.resultado, winner: match.timeVencedor,
    leaving: match.timeSaiu, startedAt: match.iniciadaEm, endedAt: match.encerradaEm,
    team1: match.ciclo.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_1).map(lineupPlayer),
    team2: match.ciclo.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_2).map(lineupPlayer),
    queue: match.ciclo.fila.map((item) => ({ participationId: item.participacaoId, name: item.participacao.jogador.nome, nickname: item.participacao.jogador.apelido, side: LadoEquipe.TIME_1 })),
    goals: match.gols.map((goal) => ({ id: goal.id, participationId: goal.participacaoId, playerName: goal.participacao.jogador.nome, playerNickname: goal.participacao.jogador.apelido, side: goal.lado, order: goal.ordemEvento, createdAt: goal.createdAt, updatedAt: goal.updatedAt })),
  }
}

async function recalculateScore(tx: Prisma.TransactionClient, matchId: string) {
  const grouped = await tx.gol.groupBy({ by: ['lado'], where: { partidaId: matchId }, _count: { _all: true } })
  const score1 = grouped.find((item) => item.lado === LadoEquipe.TIME_1)?._count._all ?? 0
  const score2 = grouped.find((item) => item.lado === LadoEquipe.TIME_2)?._count._all ?? 0
  await tx.partida.update({ where: { id: matchId }, data: { placarTime1: score1, placarTime2: score2 } })
  return { score1, score2 }
}

async function validateScorer(tx: Prisma.TransactionClient, match: { cicloId: string }, participationId: string, requestedSide?: LadoEquipe) {
  const lineup = await tx.escalacaoCiclo.findUnique({ where: { cicloId_participacaoId: { cicloId: match.cicloId, participacaoId: participationId } }, include: { participacao: true } })
  if (!lineup) throw new AppError(409, 'JOGADOR_NAO_ESCALADO', 'Somente jogador escalado nesta partida pode marcar')
  if (requestedSide && requestedSide !== lineup.lado) throw new AppError(409, 'JOGADOR_TIME_INCORRETO', 'Jogador não pertence ao time informado')
  if (lineup.participacao.tipo !== TipoParticipacao.LINHA || !lineup.participacao.presente || lineup.participacao.saiuEm) throw new AppError(409, 'JOGADOR_NAO_ESCALADO', 'Jogador não está elegível nesta partida')
  return lineup.lado
}

const ensureActive = (status: StatusPartida) => { if (status === StatusPartida.FINALIZADA) throw new AppError(409, 'PARTIDA_JA_FINALIZADA', 'Partida finalizada é imutável'); if (status !== StatusPartida.EM_ANDAMENTO) throw new AppError(409, 'PARTIDA_NAO_INICIADA', 'Partida não está em andamento') }

export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(roundId: string) { return (await this.prisma.partida.findMany({ where: { rodadaId: roundId }, include: matchInclude, orderBy: { numero: 'desc' } })).map(mapMatch) }
  async findById(id: string) { const match = await this.prisma.partida.findUnique({ where: { id }, include: matchInclude }); return match ? mapMatch(match) : null }
  async current(roundId: string) { const match = await this.prisma.partida.findFirst({ where: { rodadaId: roundId, status: StatusPartida.EM_ANDAMENTO }, include: matchInclude }); return match ? mapMatch(match) : null }

  start(roundId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockRound(tx, roundId)
      const round = await tx.rodada.findUnique({ where: { id: roundId }, include: { estadoJogo: true } })
      if (!round?.estadoJogo || round.status !== StatusRodada.EM_ANDAMENTO) throw new AppError(409, 'PARTIDA_SEM_ESTADO_VALIDO', 'Rodada não possui formação ativa')
      if (await tx.partida.findFirst({ where: { rodadaId: roundId, status: StatusPartida.EM_ANDAMENTO } })) throw new AppError(409, 'PARTIDA_EM_ANDAMENTO_EXISTENTE', 'Já existe uma partida em andamento')
      const cycle = await tx.cicloRodada.findUnique({ where: { rodadaId_numero: { rodadaId: roundId, numero: round.estadoJogo.cicloAtual } }, include: { escalacoes: { include: { participacao: true } } } })
      if (!cycle) throw new AppError(409, 'PARTIDA_SEM_ESTADO_VALIDO', 'Ciclo atual não encontrado')
      const team1 = cycle.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_1)
      const team2 = cycle.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_2)
      const ids = cycle.escalacoes.map((item) => item.participacaoId)
      if (team1.length !== 6 || team2.length !== 6 || new Set(ids).size !== 12 || cycle.escalacoes.some((item) => item.participacao.tipo !== TipoParticipacao.LINHA || !item.participacao.presente || item.participacao.saiuEm)) throw new AppError(409, 'TIME_INCOMPLETO', 'São necessários dois times válidos com 6 jogadores de linha')
      const previous = await tx.partida.findFirst({ where: { rodadaId: roundId, status: StatusPartida.FINALIZADA }, orderBy: { numero: 'desc' } })
      const permanent = previous?.timeSaiu === LadoEquipe.TIME_1 ? LadoEquipe.TIME_2 : previous?.timeSaiu === LadoEquipe.TIME_2 ? LadoEquipe.TIME_1 : LadoEquipe.TIME_1
      const entrant = permanent === LadoEquipe.TIME_1 ? LadoEquipe.TIME_2 : LadoEquipe.TIME_1
      const maximum = await tx.partida.aggregate({ where: { rodadaId: roundId }, _max: { numero: true } })
      try {
        const created = await tx.partida.create({ data: { rodadaId: roundId, cicloId: cycle.id, numero: (maximum._max.numero ?? 0) + 1, status: StatusPartida.EM_ANDAMENTO, timePermanente: permanent, timeEntrante: entrant }, include: matchInclude })
        await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: 'PARTIDA_INICIADA', detalhes: { matchId: created.id, number: created.numero, permanent, entrant } } })
        return mapMatch(created)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'PARTIDA_JA_INICIADA', 'Este ciclo já possui partida')
        throw error
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  addGoal(matchId: string, input: GoalInput, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.partida.findUnique({ where: { id: matchId } }); if (!match) throw new AppError(404, 'NOT_FOUND', 'Partida não encontrada')
      await lockRound(tx, match.rodadaId); ensureActive(match.status)
      const side = await validateScorer(tx, match, input.participationId, input.side)
      const maximum = await tx.gol.aggregate({ where: { partidaId: matchId }, _max: { ordemEvento: true } })
      const goal = await tx.gol.create({ data: { partidaId: matchId, participacaoId: input.participationId, lado: side, ordemEvento: (maximum._max.ordemEvento ?? 0) + 1 } })
      await recalculateScore(tx, matchId)
      await tx.auditoriaJogo.create({ data: { rodadaId: match.rodadaId, adminId, acao: 'GOL_CRIADO', detalhes: { matchId, goalId: goal.id, participationId: input.participationId, side } } })
      return mapMatch(await tx.partida.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude }))
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  updateGoal(goalId: string, input: GoalInput, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.gol.findUnique({ where: { id: goalId }, include: { partida: true } }); if (!goal) throw new AppError(404, 'NOT_FOUND', 'Gol não encontrado')
      await lockRound(tx, goal.partida.rodadaId); ensureActive(goal.partida.status)
      const side = await validateScorer(tx, goal.partida, input.participationId, input.side)
      await tx.gol.update({ where: { id: goalId }, data: { participacaoId: input.participationId, lado: side } }); await recalculateScore(tx, goal.partidaId)
      await tx.auditoriaJogo.create({ data: { rodadaId: goal.partida.rodadaId, adminId, acao: 'GOL_CORRIGIDO', detalhes: { matchId: goal.partidaId, goalId, participationId: input.participationId, side } } })
      return mapMatch(await tx.partida.findUniqueOrThrow({ where: { id: goal.partidaId }, include: matchInclude }))
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  removeGoal(goalId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.gol.findUnique({ where: { id: goalId }, include: { partida: true } }); if (!goal) throw new AppError(404, 'NOT_FOUND', 'Gol não encontrado')
      await lockRound(tx, goal.partida.rodadaId); ensureActive(goal.partida.status); await tx.gol.delete({ where: { id: goalId } }); await recalculateScore(tx, goal.partidaId)
      await tx.auditoriaJogo.create({ data: { rodadaId: goal.partida.rodadaId, adminId, acao: 'GOL_REMOVIDO', detalhes: { matchId: goal.partidaId, goalId } } })
      return mapMatch(await tx.partida.findUniqueOrThrow({ where: { id: goal.partidaId }, include: matchInclude }))
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  finish(matchId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.partida.findUnique({ where: { id: matchId } }); if (!match) throw new AppError(404, 'NOT_FOUND', 'Partida não encontrada')
      await lockRound(tx, match.rodadaId)
      const current = await tx.partida.findUniqueOrThrow({ where: { id: matchId } }); ensureActive(current.status)
      const { score1, score2 } = await recalculateScore(tx, matchId)
      const resolution = resolveMatch(score1, score2, current.timePermanente as TeamSide, current.timeEntrante as TeamSide)
      await tx.partida.update({ where: { id: matchId }, data: { status: StatusPartida.FINALIZADA, resultado: resolution.result as ResultadoPartida, timeVencedor: resolution.winner as LadoEquipe | null, timeSaiu: resolution.leaving as LadoEquipe, encerradaEm: new Date(), placarTime1: score1, placarTime2: score2 } })
      await rotateRoundInTransaction(tx, match.rodadaId, resolution.leaving as LadoEquipe, adminId, 'RODIZIO_PARTIDA')
      await tx.auditoriaJogo.create({ data: { rodadaId: match.rodadaId, adminId, acao: 'PARTIDA_FINALIZADA', detalhes: { matchId, score1, score2, result: resolution.result, staying: resolution.staying, leaving: resolution.leaving } } })
      return mapMatch(await tx.partida.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude }))
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  }
}
