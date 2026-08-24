import type { Prisma, PrismaClient } from '@prisma/client'
import type { JogadorEntity } from '../../shared/entities.js'

export interface JogadorCreateData { nome: string; apelido: string; telefone: string }
export interface JogadorUpdateData { nome?: string; apelido?: string; telefone?: string; ativo?: boolean }

export interface JogadorRepository {
  list(search?: string, onlyActive?: boolean): Promise<JogadorEntity[]>
  findById(id: string): Promise<JogadorEntity | null>
  create(data: JogadorCreateData): Promise<JogadorEntity>
  update(id: string, data: JogadorUpdateData): Promise<JogadorEntity | null>
}

export class PrismaJogadorRepository implements JogadorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list(search?: string, onlyActive = false) {
    const where: Prisma.JogadorWhereInput = {}
    if (onlyActive) where.ativo = true
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { apelido: { contains: search, mode: 'insensitive' } },
      ]
    }
    return this.prisma.jogador.findMany({ where, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] })
  }

  findById(id: string) { return this.prisma.jogador.findUnique({ where: { id } }) }
  create(data: JogadorCreateData) { return this.prisma.jogador.create({ data: { ...data, ativo: true } }) }
  async update(id: string, data: JogadorUpdateData) {
    const exists = await this.prisma.jogador.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return null
    return this.prisma.jogador.update({ where: { id }, data })
  }
}
