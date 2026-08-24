import { Prisma, PrismaClient, StatusPagamento, StatusRodada, TipoParticipacao } from '@prisma/client'
import type { JogadorCreateData } from '../jogadores/jogador.repository.js'
import { AppError } from '../../shared/errors.js'

export interface RodadaCreateData { data: string; horario: string; valorJogadorLinha: number }
export interface RodadaUpdateData { data?: string; horario?: string; valorJogadorLinha?: number }
export interface ParticipacaoCreateData { jogadorId: string; tipo: TipoParticipacao; confirmado: boolean; presente: boolean }
export interface ParticipacaoUpdateData { tipo?: TipoParticipacao; confirmado?: boolean; presente?: boolean }

export interface RodadaRecord {
  id: string
  data: Date
  horario: Date
  status: StatusRodada
  valorJogadorLinha: number
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  endedAt: Date | null
  participacoes: Array<{
    id: string
    tipo: TipoParticipacao
    confirmado: boolean
    presente: boolean
    ordemChegada: number | null
    chegouEm: Date | null
    saiuEm: Date | null
    jogador: { id: string; nome: string; apelido: string; telefone: string; ativo: boolean; createdAt: Date; updatedAt: Date }
    pagamento: { id: string; valor: number; status: StatusPagamento; pagoEm: Date | null } | null
  }>
}

export interface RodadaRepository {
  list(): Promise<RodadaRecord[]>
  findById(id: string): Promise<RodadaRecord | null>
  findCurrent(): Promise<RodadaRecord | null>
  create(data: RodadaCreateData, adminId: string): Promise<RodadaRecord>
  update(id: string, data: RodadaUpdateData): Promise<RodadaRecord>
  transition(id: string, from: StatusRodada, to: StatusRodada): Promise<RodadaRecord>
  addParticipacao(rodadaId: string, data: ParticipacaoCreateData, adminId: string): Promise<RodadaRecord>
  addJogadorRapido(rodadaId: string, jogador: JogadorCreateData, participacao: Omit<ParticipacaoCreateData, 'jogadorId'>, adminId: string): Promise<RodadaRecord>
  updateParticipacao(id: string, data: ParticipacaoUpdateData, adminId: string): Promise<RodadaRecord>
  removeParticipacao(id: string): Promise<RodadaRecord>
  updatePagamento(id: string, status: StatusPagamento, adminId: string): Promise<RodadaRecord>
}

const includeRodada = {
  participacoes: {
    include: { jogador: true, pagamento: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.RodadaInclude
type PrismaRodada = Prisma.RodadaGetPayload<{ include: typeof includeRodada }>

function mapRodada(rodada: PrismaRodada): RodadaRecord {
  return {
    ...rodada,
    valorJogadorLinha: rodada.valorJogadorLinha.toNumber(),
    participacoes: rodada.participacoes.map((p) => ({
      ...p,
      pagamento: p.pagamento ? { ...p.pagamento, valor: p.pagamento.valor.toNumber() } : null,
    })),
  }
}
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const asTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`)
const mutable = (status: StatusRodada) => status === StatusRodada.PLANEJADA || status === StatusRodada.PREPARACAO || status === StatusRodada.EM_ANDAMENTO
const ensureMutable = (status: StatusRodada) => { if (!mutable(status)) throw new AppError(409, 'RODADA_ENCERRADA', 'Rodada encerrada ou cancelada é somente leitura') }

export class PrismaRodadaRepository implements RodadaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    return (await this.prisma.rodada.findMany({ include: includeRodada, orderBy: [{ data: 'desc' }, { horario: 'desc' }] })).map(mapRodada)
  }
  async findById(id: string) {
    const rodada = await this.prisma.rodada.findUnique({ where: { id }, include: includeRodada })
    return rodada ? mapRodada(rodada) : null
  }
  async findCurrent() {
    const preparation = await this.prisma.rodada.findFirst({ where: { status: { in: [StatusRodada.EM_ANDAMENTO, StatusRodada.PREPARACAO] } }, include: includeRodada, orderBy: { data: 'desc' } })
    if (preparation) return mapRodada(preparation)
    const rodada = await this.prisma.rodada.findFirst({ where: { status: StatusRodada.PLANEJADA }, include: includeRodada, orderBy: [{ data: 'asc' }, { horario: 'asc' }] })
    return rodada ? mapRodada(rodada) : null
  }
  async create(data: RodadaCreateData, adminId: string) {
    const rodada = await this.prisma.rodada.create({ data: { data: asDate(data.data), horario: asTime(data.horario), valorJogadorLinha: data.valorJogadorLinha, createdBy: adminId }, include: includeRodada })
    return mapRodada(rodada)
  }
  async update(id: string, data: RodadaUpdateData) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.rodada.findUnique({ where: { id } })
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Rodada não encontrada')
      ensureMutable(current.status)
      if (data.valorJogadorLinha !== undefined && Number(current.valorJogadorLinha) !== data.valorJogadorLinha) {
        const paid = await tx.pagamento.count({ where: { participacao: { rodadaId: id }, status: StatusPagamento.PAGO } })
        if (paid) throw new AppError(409, 'PAGAMENTO_PAGO', 'Marque os pagamentos como pendentes antes de alterar o valor da rodada')
        await tx.pagamento.updateMany({ where: { participacao: { rodadaId: id } }, data: { valor: data.valorJogadorLinha } })
      }
      const rodada = await tx.rodada.update({ where: { id }, data: { ...(data.data ? { data: asDate(data.data) } : {}), ...(data.horario ? { horario: asTime(data.horario) } : {}), ...(data.valorJogadorLinha !== undefined ? { valorJogadorLinha: data.valorJogadorLinha } : {}) }, include: includeRodada })
      return mapRodada(rodada)
    })
  }
  async transition(id: string, from: StatusRodada, to: StatusRodada) {
    return this.prisma.$transaction(async (tx) => {
      if (to === StatusRodada.CANCELADA) {
        const paid = await tx.pagamento.count({ where: { participacao: { rodadaId: id }, status: StatusPagamento.PAGO } })
        if (paid) throw new AppError(409, 'PAGAMENTO_PAGO', 'Corrija pagamentos pagos antes de cancelar a rodada')
        await tx.pagamento.deleteMany({ where: { participacao: { rodadaId: id } } })
      }
      const result = await tx.rodada.updateMany({ where: { id, status: from }, data: { status: to, ...(to === StatusRodada.ENCERRADA ? { endedAt: new Date() } : {}) } })
      if (!result.count) throw new AppError(409, 'TRANSICAO_INVALIDA', 'O status da rodada foi alterado; atualize a página')
      return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id }, include: includeRodada }))
    })
  }
  async addParticipacao(rodadaId: string, data: ParticipacaoCreateData, adminId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rodada = await tx.rodada.findUnique({ where: { id: rodadaId } })
        if (!rodada) throw new AppError(404, 'NOT_FOUND', 'Rodada não encontrada')
        ensureMutable(rodada.status)
        const jogador = await tx.jogador.findUnique({ where: { id: data.jogadorId } })
        if (!jogador?.ativo) throw new AppError(404, 'NOT_FOUND', 'Jogador ativo não encontrado')
        const participacao = await tx.participacaoRodada.create({ data: { rodadaId, ...data } })
        if (data.tipo === TipoParticipacao.LINHA && data.presente) await tx.pagamento.create({ data: { participacaoId: participacao.id, valor: rodada.valorJogadorLinha, updatedBy: adminId } })
        return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id: rodadaId }, include: includeRodada }))
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'JOGADOR_JA_PARTICIPA', 'Jogador já participa desta rodada')
      throw error
    }
  }
  async addJogadorRapido(rodadaId: string, jogador: JogadorCreateData, participacao: Omit<ParticipacaoCreateData, 'jogadorId'>, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rodada = await tx.rodada.findUnique({ where: { id: rodadaId } })
      if (!rodada) throw new AppError(404, 'NOT_FOUND', 'Rodada não encontrada')
      ensureMutable(rodada.status)
      const novo = await tx.jogador.create({ data: { ...jogador, ativo: true } })
      const created = await tx.participacaoRodada.create({ data: { rodadaId, jogadorId: novo.id, ...participacao } })
      if (participacao.tipo === TipoParticipacao.LINHA && participacao.presente) await tx.pagamento.create({ data: { participacaoId: created.id, valor: rodada.valorJogadorLinha, updatedBy: adminId } })
      return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id: rodadaId }, include: includeRodada }))
    })
  }
  async updateParticipacao(id: string, data: ParticipacaoUpdateData, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.participacaoRodada.findUnique({ where: { id }, include: { rodada: { include: { estadoJogo: true } }, pagamento: true, escalacoes: true } })
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Participação não encontrada')
      ensureMutable(current.rodada.status)
      const tipo = data.tipo ?? current.tipo
      const presente = data.presente ?? current.presente
      const eligible = tipo === TipoParticipacao.LINHA && presente
      if (current.escalacoes.length && !eligible) throw new AppError(409, 'JOGADOR_UTILIZADO_NO_MOTOR', 'Use a ação de saída para jogador já utilizado no motor')
      if (!eligible && current.pagamento?.status === StatusPagamento.PAGO) throw new AppError(409, 'PAGAMENTO_PAGO', 'Marque o pagamento como pendente antes desta alteração')
      const lateLine = current.rodada.estadoJogo && current.tipo === TipoParticipacao.GOLEIRO && tipo === TipoParticipacao.LINHA && presente && !current.ordemChegada
      let arrivalData: { ordemChegada: number; chegouEm: Date } | undefined
      if (lateLine) {
        const maximum = await tx.participacaoRodada.aggregate({ where: { rodadaId: current.rodadaId, ordemChegada: { not: null } }, _max: { ordemChegada: true } })
        arrivalData = { ordemChegada: (maximum._max.ordemChegada ?? 0) + 1, chegouEm: new Date() }
      }
      await tx.participacaoRodada.update({ where: { id }, data: { ...data, ...arrivalData } })
      if (lateLine) {
        const cycle = await tx.cicloRodada.findUniqueOrThrow({ where: { rodadaId_numero: { rodadaId: current.rodadaId, numero: current.rodada.estadoJogo!.cicloAtual } } })
        const maximum = await tx.filaCiclo.aggregate({ where: { cicloId: cycle.id }, _max: { posicao: true } })
        await tx.filaCiclo.create({ data: { cicloId: cycle.id, participacaoId: id, posicao: (maximum._max.posicao ?? 0) + 1 } })
      }
      if (eligible) {
        await tx.pagamento.upsert({ where: { participacaoId: id }, update: {}, create: { participacaoId: id, valor: current.rodada.valorJogadorLinha, updatedBy: adminId } })
      } else if (current.pagamento) await tx.pagamento.delete({ where: { participacaoId: id } })
      return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id: current.rodadaId }, include: includeRodada }))
    })
  }
  async removeParticipacao(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.participacaoRodada.findUnique({ where: { id }, include: { rodada: true, pagamento: true, escalacoes: true } })
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Participação não encontrada')
      ensureMutable(current.rodada.status)
      if (current.pagamento?.status === StatusPagamento.PAGO) throw new AppError(409, 'PAGAMENTO_PAGO', 'Marque o pagamento como pendente antes de remover o participante')
      if (current.escalacoes.length) throw new AppError(409, 'JOGADOR_UTILIZADO_NO_MOTOR', 'Use a ação de saída para jogador já utilizado no motor')
      await tx.participacaoRodada.delete({ where: { id } })
      return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id: current.rodadaId }, include: includeRodada }))
    })
  }
  async updatePagamento(id: string, status: StatusPagamento, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.pagamento.findUnique({ where: { id }, include: { participacao: { include: { rodada: true } } } })
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Pagamento não encontrado')
      ensureMutable(current.participacao.rodada.status)
      await tx.pagamento.update({ where: { id }, data: { status, pagoEm: status === StatusPagamento.PAGO ? new Date() : null, updatedBy: adminId } })
      return mapRodada(await tx.rodada.findUniqueOrThrow({ where: { id: current.participacao.rodadaId }, include: includeRodada }))
    })
  }
}
