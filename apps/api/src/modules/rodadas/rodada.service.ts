import { StatusPagamento, StatusRodada, TipoParticipacao } from '@prisma/client'
import {
  jogadorRapidoSchema,
  pagamentoUpdateSchema,
  participacaoCreateSchema,
  participacaoUpdateSchema,
  rodadaCreateSchema,
  rodadaUpdateSchema,
} from '@fut-brita/shared'
import type { RodadaRecord, RodadaRepository } from './rodada.repository.js'
import { AppError } from '../../shared/errors.js'

const dateDto = (date: Date) => date.toISOString().slice(0, 10)
const timeDto = (date: Date) => `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`

export function resumoDto(rodada: RodadaRecord) {
  const presentes = rodada.participacoes.filter((p) => p.presente)
  const totalPrevisto = rodada.participacoes.reduce((sum, p) => sum + (p.pagamento?.valor ?? 0), 0)
  const totalRecebido = rodada.participacoes.reduce((sum, p) => sum + (p.pagamento?.status === StatusPagamento.PAGO ? p.pagamento.valor : 0), 0)
  return {
    totalParticipantes: rodada.participacoes.length,
    linhasPresentes: presentes.filter((p) => p.tipo === TipoParticipacao.LINHA).length,
    goleirosPresentes: presentes.filter((p) => p.tipo === TipoParticipacao.GOLEIRO).length,
    ausentes: rodada.participacoes.filter((p) => !p.presente).length,
    totalPrevisto,
    totalRecebido,
    totalPendente: totalPrevisto - totalRecebido,
  }
}

export function rodadaAdminDto(rodada: RodadaRecord) {
  return {
    id: rodada.id,
    data: dateDto(rodada.data),
    horario: timeDto(rodada.horario),
    status: rodada.status,
    valorJogadorLinha: rodada.valorJogadorLinha,
    createdAt: rodada.createdAt.toISOString(),
    updatedAt: rodada.updatedAt.toISOString(),
    startedAt: rodada.startedAt?.toISOString() ?? null,
    endedAt: rodada.endedAt?.toISOString() ?? null,
    participacoes: rodada.participacoes.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      confirmado: p.confirmado,
      presente: p.presente,
      ordemChegada: p.ordemChegada,
      chegouEm: p.chegouEm?.toISOString() ?? null,
      saiuEm: p.saiuEm?.toISOString() ?? null,
      jogador: { ...p.jogador, createdAt: p.jogador.createdAt.toISOString(), updatedAt: p.jogador.updatedAt.toISOString() },
      pagamento: p.pagamento ? { ...p.pagamento, pagoEm: p.pagamento.pagoEm?.toISOString() ?? null } : null,
    })),
    resumo: resumoDto(rodada),
  }
}

export const rodadaListaDto = (rodada: RodadaRecord) => ({
  id: rodada.id,
  data: dateDto(rodada.data),
  horario: timeDto(rodada.horario),
  status: rodada.status,
  valorJogadorLinha: rodada.valorJogadorLinha,
  totalParticipantes: rodada.participacoes.length,
})

export const rodadaPublicaDto = (rodada: RodadaRecord) => ({
  id: rodada.id,
  data: dateDto(rodada.data),
  horario: timeDto(rodada.horario),
  status: rodada.status,
  participacoes: rodada.participacoes.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    confirmado: p.confirmado,
    presente: p.presente,
    jogador: { id: p.jogador.id, nome: p.jogador.nome, apelido: p.jogador.apelido },
  })),
})

const transitions: Partial<Record<StatusRodada, StatusRodada[]>> = {
  [StatusRodada.PLANEJADA]: [StatusRodada.PREPARACAO, StatusRodada.CANCELADA],
  [StatusRodada.PREPARACAO]: [StatusRodada.ENCERRADA, StatusRodada.CANCELADA],
  [StatusRodada.EM_ANDAMENTO]: [StatusRodada.ENCERRADA],
}

export class RodadaService {
  constructor(private readonly rodadas: RodadaRepository) {}
  async list() { return (await this.rodadas.list()).map(rodadaListaDto) }
  async find(id: string) {
    const rodada = await this.rodadas.findById(id)
    if (!rodada) throw new AppError(404, 'NOT_FOUND', 'Rodada não encontrada')
    return rodada
  }
  async create(input: unknown, adminId: string) {
    const data = rodadaCreateSchema.parse(input)
    return rodadaAdminDto(await this.rodadas.create(data, adminId))
  }
  async update(id: string, input: unknown) {
    const data = rodadaUpdateSchema.parse(input)
    if (!Object.keys(data).length) throw new AppError(400, 'VALIDATION_ERROR', 'Informe ao menos um campo')
    const current = await this.find(id)
    if (data.status) {
      if (Object.keys(data).length !== 1) throw new AppError(400, 'VALIDATION_ERROR', 'Altere o status separadamente dos demais campos')
      const target = data.status as StatusRodada
      if (!transitions[current.status]?.includes(target)) throw new AppError(409, 'TRANSICAO_INVALIDA', `Transição de ${current.status} para ${target} não permitida`)
      return rodadaAdminDto(await this.rodadas.transition(id, current.status, target))
    }
    return rodadaAdminDto(await this.rodadas.update(id, data))
  }
  async addParticipacao(id: string, input: unknown, adminId: string) {
    const data = participacaoCreateSchema.parse(input)
    return rodadaAdminDto(await this.rodadas.addParticipacao(id, { ...data, tipo: data.tipo as TipoParticipacao }, adminId))
  }
  async addJogadorRapido(id: string, input: unknown, adminId: string) {
    const data = jogadorRapidoSchema.parse(input)
    const { nome, apelido, telefone, tipo, confirmado, presente } = data
    return rodadaAdminDto(await this.rodadas.addJogadorRapido(id, { nome, apelido, telefone }, { tipo: tipo as TipoParticipacao, confirmado, presente }, adminId))
  }
  async updateParticipacao(id: string, input: unknown, adminId: string) {
    const data = participacaoUpdateSchema.parse(input)
    if (!Object.keys(data).length) throw new AppError(400, 'VALIDATION_ERROR', 'Informe ao menos um campo')
    return rodadaAdminDto(await this.rodadas.updateParticipacao(id, { ...data, ...(data.tipo ? { tipo: data.tipo as TipoParticipacao } : {}) }, adminId))
  }
  async removeParticipacao(id: string) { return rodadaAdminDto(await this.rodadas.removeParticipacao(id)) }
  async updatePagamento(id: string, input: unknown, adminId: string) {
    const data = pagamentoUpdateSchema.parse(input)
    return rodadaAdminDto(await this.rodadas.updatePagamento(id, data.status as StatusPagamento, adminId))
  }
  async financial(id: string) { return resumoDto(await this.find(id)) }
  async currentPublic() {
    const rodada = await this.rodadas.findCurrent()
    if (!rodada) throw new AppError(404, 'NOT_FOUND', 'Nenhuma rodada atual encontrada')
    return rodadaPublicaDto(rodada)
  }
  async publicById(id: string) { return rodadaPublicaDto(await this.find(id)) }
}
