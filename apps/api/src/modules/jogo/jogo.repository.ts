import { LadoEquipe, Prisma, PrismaClient, StatusRodada, TipoParticipacao } from '@prisma/client'
import { formInitialTeams, rotateTeams, type PermanenceStat, type RotationPlayer } from '../../domain/rotation/rotation-engine.js'
import { AppError } from '../../shared/errors.js'

export interface GamePlayerRecord extends RotationPlayer {
  participationId: string
  name: string
  nickname: string
}
export interface ArrivalRecord extends GamePlayerRecord { arrivedAt: Date }
export interface GameStateRecord {
  roundId: string
  cycle: number
  version: number
  team1: GamePlayerRecord[]
  team2: GamePlayerRecord[]
  queue: GamePlayerRecord[]
}
export interface GameRepository {
  arrivals(roundId: string): Promise<ArrivalRecord[]>
  state(roundId: string): Promise<GameStateRecord | null>
  registerArrival(roundId: string, participationId: string, adminId: string): Promise<GameStateRecord | null>
  reorder(roundId: string, participationIds: string[], adminId: string): Promise<ArrivalRecord[]>
  removeArrival(roundId: string, participationId: string, adminId: string): Promise<ArrivalRecord[]>
  formInitial(roundId: string, adminId: string): Promise<GameStateRecord>
  rotate(roundId: string, leaving: LadoEquipe, adminId: string): Promise<GameStateRecord>
  markExit(participationId: string, adminId: string): Promise<GameStateRecord | null>
}

type Db = Prisma.TransactionClient | PrismaClient
const player = (participation: { id: string; ordemChegada: number | null; jogador: { nome: string; apelido: string } }): GamePlayerRecord => ({
  id: participation.id, participationId: participation.id, name: participation.jogador.nome,
  nickname: participation.jogador.apelido, arrivalOrder: participation.ordemChegada ?? Number.MAX_SAFE_INTEGER,
})
export const lockRound = async (tx: Prisma.TransactionClient, roundId: string) => { await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', roundId) }
const eligibleStatus = (status: StatusRodada) => status === StatusRodada.PREPARACAO || status === StatusRodada.EM_ANDAMENTO

async function stateFrom(db: Db, roundId: string): Promise<GameStateRecord | null> {
  const state = await db.estadoRodadaJogo.findUnique({ where: { rodadaId: roundId } })
  if (!state) return null
  const cycle = await db.cicloRodada.findUniqueOrThrow({
    where: { rodadaId_numero: { rodadaId: roundId, numero: state.cicloAtual } },
    include: {
      escalacoes: { include: { participacao: { include: { jogador: true } } }, orderBy: { participacao: { ordemChegada: 'asc' } } },
      fila: { include: { participacao: { include: { jogador: true } } }, orderBy: { posicao: 'asc' } },
    },
  })
  return {
    roundId, cycle: state.cicloAtual, version: state.versao,
    team1: cycle.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_1).map((item) => player(item.participacao)),
    team2: cycle.escalacoes.filter((item) => item.lado === LadoEquipe.TIME_2).map((item) => player(item.participacao)),
    queue: cycle.fila.map((item) => player(item.participacao)),
  }
}

async function arrivalsFrom(db: Db, roundId: string): Promise<ArrivalRecord[]> {
  const rows = await db.participacaoRodada.findMany({ where: { rodadaId: roundId, ordemChegada: { not: null } }, include: { jogador: true }, orderBy: { ordemChegada: 'asc' } })
  return rows.map((item) => ({ ...player(item), arrivedAt: item.chegouEm! }))
}

async function normalizeQueue(tx: Prisma.TransactionClient, cycleId: string) {
  const rows = await tx.filaCiclo.findMany({ where: { cicloId: cycleId }, orderBy: { posicao: 'asc' } })
  for (let index = 0; index < rows.length; index++) await tx.filaCiclo.update({ where: { id: rows[index].id }, data: { posicao: -(index + 1) } })
  for (let index = 0; index < rows.length; index++) await tx.filaCiclo.update({ where: { id: rows[index].id }, data: { posicao: index + 1 } })
}

export async function rotateRoundInTransaction(tx: Prisma.TransactionClient, roundId: string, leaving: LadoEquipe, adminId: string, auditAction = 'RODIZIO_SIMULADO') {
  await lockRound(tx, roundId)
  const round = await tx.rodada.findUnique({ where: { id: roundId }, include: { estadoJogo: true } })
  if (!round?.estadoJogo || round.status !== StatusRodada.EM_ANDAMENTO) throw new AppError(409, 'RODADA_NAO_ELEGIVEL', 'Rodada não está com o motor em andamento')
  if (auditAction === 'RODIZIO_SIMULADO' && await tx.partida.findFirst({ where: { rodadaId: roundId, status: 'EM_ANDAMENTO' } })) throw new AppError(409, 'PARTIDA_EM_ANDAMENTO_EXISTENTE', 'O resultado da partida em andamento deve determinar o rodízio')
  const current = (await stateFrom(tx, roundId))!
  if (current.team1.length !== 6 || current.team2.length !== 6) throw new AppError(409, 'ESTADO_JOGO_INVALIDO', 'Quantidade insuficiente para formar dois times completos.')
  const permanenceRows = await tx.permanenciaRodada.findMany({ where: { rodadaId: roundId } })
  const stats: Record<string, PermanenceStat> = Object.fromEntries(permanenceRows.map((item) => [item.participacaoId, { count: item.quantidade, lastCycle: item.ultimaPermanenciaCiclo }]))
  const result = rotateTeams({ stayingTeam: leaving === LadoEquipe.TIME_1 ? current.team2 : current.team1, leavingTeam: leaving === LadoEquipe.TIME_1 ? current.team1 : current.team2, queue: current.queue, permanenceStats: stats, nextCycle: current.cycle + 1 })
  const cycle = await tx.cicloRodada.create({ data: { rodadaId: roundId, numero: current.cycle + 1, timeSaiu: leaving } })
  const team1 = leaving === LadoEquipe.TIME_1 ? result.newTeam : result.stayingTeam
  const team2 = leaving === LadoEquipe.TIME_2 ? result.newTeam : result.stayingTeam
  const remained = new Set(result.remainingPlayers.map((p) => p.id))
  await tx.escalacaoCiclo.createMany({ data: [...team1.map((p) => ({ cicloId: cycle.id, participacaoId: p.id, lado: LadoEquipe.TIME_1, permaneceu: remained.has(p.id) })), ...team2.map((p) => ({ cicloId: cycle.id, participacaoId: p.id, lado: LadoEquipe.TIME_2, permaneceu: remained.has(p.id) }))] })
  if (result.newQueue.length) await tx.filaCiclo.createMany({ data: result.newQueue.map((p, index) => ({ cicloId: cycle.id, participacaoId: p.id, posicao: index + 1 })) })
  for (const p of result.remainingPlayers) await tx.permanenciaRodada.upsert({ where: { rodadaId_participacaoId: { rodadaId: roundId, participacaoId: p.id } }, create: { rodadaId: roundId, participacaoId: p.id, quantidade: 1, ultimaPermanenciaCiclo: current.cycle + 1 }, update: { quantidade: { increment: 1 }, ultimaPermanenciaCiclo: current.cycle + 1 } })
  await tx.estadoRodadaJogo.update({ where: { rodadaId: roundId }, data: { cicloAtual: { increment: 1 }, versao: { increment: 1 } } })
  await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: auditAction, detalhes: { leaving, remained: [...remained], cycle: current.cycle + 1 } } })
  return (await stateFrom(tx, roundId))!
}

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}
  arrivals(roundId: string) { return arrivalsFrom(this.prisma, roundId) }
  state(roundId: string) { return stateFrom(this.prisma, roundId) }

  registerArrival(roundId: string, participationId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockRound(tx, roundId)
      const participation = await tx.participacaoRodada.findUnique({ where: { id: participationId }, include: { rodada: { include: { estadoJogo: true } } } })
      if (!participation || participation.rodadaId !== roundId) throw new AppError(404, 'NOT_FOUND', 'Participação não encontrada nesta rodada')
      if (!eligibleStatus(participation.rodada.status)) throw new AppError(409, 'RODADA_NAO_ELEGIVEL', 'Rodada deve estar em preparação ou andamento')
      if (participation.tipo !== TipoParticipacao.LINHA) throw new AppError(409, 'JOGADOR_NAO_E_LINHA', 'Somente jogador de linha recebe chegada')
      if (!participation.presente) throw new AppError(409, 'JOGADOR_AUSENTE', 'Jogador precisa estar presente')
      if (participation.saiuEm) throw new AppError(409, 'JOGADOR_JA_SAIU', 'Jogador já saiu desta rodada')
      if (participation.ordemChegada) throw new AppError(409, 'CHEGADA_JA_REGISTRADA', 'Chegada já registrada')
      const maximum = await tx.participacaoRodada.aggregate({ where: { rodadaId: roundId, ordemChegada: { not: null } }, _max: { ordemChegada: true } })
      const order = (maximum._max.ordemChegada ?? 0) + 1
      await tx.participacaoRodada.update({ where: { id: participationId }, data: { ordemChegada: order, chegouEm: new Date() } })
      if (participation.rodada.estadoJogo) {
        const cycle = await tx.cicloRodada.findUniqueOrThrow({ where: { rodadaId_numero: { rodadaId: roundId, numero: participation.rodada.estadoJogo.cicloAtual } } })
        const maxQueue = await tx.filaCiclo.aggregate({ where: { cicloId: cycle.id }, _max: { posicao: true } })
        await tx.filaCiclo.create({ data: { cicloId: cycle.id, participacaoId: participationId, posicao: (maxQueue._max.posicao ?? 0) + 1 } })
      }
      await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: participation.rodada.estadoJogo ? 'CHEGADA_TARDIA' : 'REGISTRAR_CHEGADA', detalhes: { participationId, order } } })
      return stateFrom(tx, roundId)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  reorder(roundId: string, participationIds: string[], adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockRound(tx, roundId)
      if (await tx.estadoRodadaJogo.findUnique({ where: { rodadaId: roundId } })) throw new AppError(409, 'ORDEM_FECHADA', 'A ordem foi fechada pela formação inicial')
      const current = await tx.participacaoRodada.findMany({ where: { rodadaId: roundId, ordemChegada: { not: null } }, orderBy: { ordemChegada: 'asc' } })
      if (current.length !== participationIds.length || new Set(participationIds).size !== current.length || participationIds.some((id) => !current.some((item) => item.id === id))) throw new AppError(400, 'ORDEM_INVALIDA', 'Envie todos os jogadores da chegada uma única vez')
      for (let index = 0; index < participationIds.length; index++) await tx.participacaoRodada.update({ where: { id: participationIds[index] }, data: { ordemChegada: -(index + 1) } })
      for (let index = 0; index < participationIds.length; index++) await tx.participacaoRodada.update({ where: { id: participationIds[index] }, data: { ordemChegada: index + 1 } })
      await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: 'REORDENAR_CHEGADA', detalhes: { participationIds } } })
      return arrivalsFrom(tx, roundId)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  removeArrival(roundId: string, participationId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockRound(tx, roundId)
      if (await tx.estadoRodadaJogo.findUnique({ where: { rodadaId: roundId } })) throw new AppError(409, 'ORDEM_FECHADA', 'A ordem foi fechada pela formação inicial')
      const target = await tx.participacaoRodada.findUnique({ where: { id: participationId } })
      if (!target || target.rodadaId !== roundId || !target.ordemChegada) throw new AppError(404, 'NOT_FOUND', 'Chegada não encontrada')
      await tx.participacaoRodada.update({ where: { id: participationId }, data: { ordemChegada: null, chegouEm: null } })
      const remaining = await tx.participacaoRodada.findMany({ where: { rodadaId: roundId, ordemChegada: { not: null } }, orderBy: { ordemChegada: 'asc' } })
      for (let index = 0; index < remaining.length; index++) await tx.participacaoRodada.update({ where: { id: remaining[index].id }, data: { ordemChegada: -(index + 1) } })
      for (let index = 0; index < remaining.length; index++) await tx.participacaoRodada.update({ where: { id: remaining[index].id }, data: { ordemChegada: index + 1 } })
      await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: 'REMOVER_CHEGADA', detalhes: { participationId } } })
      return arrivalsFrom(tx, roundId)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  formInitial(roundId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockRound(tx, roundId)
      const round = await tx.rodada.findUnique({ where: { id: roundId }, include: { estadoJogo: true } })
      if (!round) throw new AppError(404, 'NOT_FOUND', 'Rodada não encontrada')
      if (round.status !== StatusRodada.PREPARACAO) throw new AppError(409, 'RODADA_NAO_ELEGIVEL', 'Rodada deve estar em preparação')
      if (round.estadoJogo) throw new AppError(409, 'FORMACAO_JA_CRIADA', 'Formação inicial já criada')
      const eligible = await tx.participacaoRodada.findMany({ where: { rodadaId: roundId, tipo: TipoParticipacao.LINHA, presente: true, saiuEm: null, ordemChegada: { not: null } }, include: { jogador: true }, orderBy: { ordemChegada: 'asc' } })
      if (eligible.length < 12) throw new AppError(409, 'JOGADORES_INSUFICIENTES', 'São necessários pelo menos 12 jogadores de linha para formar os dois times.')
      const initial = formInitialTeams(eligible.map(player))
      await tx.estadoRodadaJogo.create({ data: { rodadaId: roundId } })
      const cycle = await tx.cicloRodada.create({ data: { rodadaId: roundId, numero: 1 } })
      await tx.escalacaoCiclo.createMany({ data: [...initial.team1.map((p) => ({ cicloId: cycle.id, participacaoId: p.id, lado: LadoEquipe.TIME_1 })), ...initial.team2.map((p) => ({ cicloId: cycle.id, participacaoId: p.id, lado: LadoEquipe.TIME_2 }))] })
      if (initial.queue.length) await tx.filaCiclo.createMany({ data: initial.queue.map((p, index) => ({ cicloId: cycle.id, participacaoId: p.id, posicao: index + 1 })) })
      await tx.permanenciaRodada.createMany({ data: eligible.map((p) => ({ rodadaId: roundId, participacaoId: p.id })) })
      await tx.rodada.update({ where: { id: roundId }, data: { status: StatusRodada.EM_ANDAMENTO, startedAt: new Date() } })
      await tx.auditoriaJogo.create({ data: { rodadaId: roundId, adminId, acao: 'FORMACAO_INICIAL', detalhes: { total: eligible.length } } })
      return (await stateFrom(tx, roundId))!
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  rotate(roundId: string, leaving: LadoEquipe, adminId: string) {
    return this.prisma.$transaction((tx) => rotateRoundInTransaction(tx, roundId, leaving, adminId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  markExit(participationId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const participation = await tx.participacaoRodada.findUnique({ where: { id: participationId }, include: { rodada: { include: { estadoJogo: true } } } })
      if (!participation) throw new AppError(404, 'NOT_FOUND', 'Participação não encontrada')
      await lockRound(tx, participation.rodadaId)
      if (participation.saiuEm) throw new AppError(409, 'JOGADOR_JA_SAIU', 'Jogador já saiu')
      if (!eligibleStatus(participation.rodada.status)) throw new AppError(409, 'RODADA_NAO_ELEGIVEL', 'Rodada não aceita saídas')
      if (participation.rodada.estadoJogo) {
        const liveMatch = await tx.partida.findFirst({ where: { rodadaId: participation.rodadaId, status: 'EM_ANDAMENTO', ciclo: { numero: participation.rodada.estadoJogo.cicloAtual } } })
        if (liveMatch) throw new AppError(409, 'PARTIDA_EM_ANDAMENTO_EXISTENTE', 'Saídas operacionais são permitidas apenas entre partidas')
      }
      await tx.participacaoRodada.update({ where: { id: participationId }, data: { saiuEm: new Date() } })
      if (participation.rodada.estadoJogo) {
        const cycle = await tx.cicloRodada.findUniqueOrThrow({ where: { rodadaId_numero: { rodadaId: participation.rodadaId, numero: participation.rodada.estadoJogo.cicloAtual } }, include: { escalacoes: true, fila: { orderBy: { posicao: 'asc' } } } })
        const queued = cycle.fila.find((item) => item.participacaoId === participationId)
        const lineup = cycle.escalacoes.find((item) => item.participacaoId === participationId)
        if (queued) await tx.filaCiclo.delete({ where: { id: queued.id } })
        if (lineup) {
          await tx.escalacaoCiclo.delete({ where: { id: lineup.id } })
          const replacement = cycle.fila.find((item) => item.participacaoId !== participationId)
          if (replacement) {
            await tx.filaCiclo.delete({ where: { id: replacement.id } })
            await tx.escalacaoCiclo.create({ data: { cicloId: cycle.id, participacaoId: replacement.participacaoId, lado: lineup.lado } })
          }
        }
        await normalizeQueue(tx, cycle.id)
        await tx.estadoRodadaJogo.update({ where: { rodadaId: participation.rodadaId }, data: { versao: { increment: 1 } } })
      }
      await tx.auditoriaJogo.create({ data: { rodadaId: participation.rodadaId, adminId, acao: 'SAIDA_ANTECIPADA', detalhes: { participationId } } })
      return stateFrom(tx, participation.rodadaId)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
}
