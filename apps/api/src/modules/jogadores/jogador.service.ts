import { jogadorCreateSchema, jogadorUpdateSchema } from '@fut-brita/shared'
import type { JogadorRepository } from './jogador.repository.js'
import { AppError } from '../../shared/errors.js'
import type { JogadorEntity } from '../../shared/entities.js'

export class JogadorService {
  constructor(private readonly jogadores: JogadorRepository) {}
  list(search?: string) { return this.jogadores.list(search?.trim() || undefined) }
  listPublic() { return this.jogadores.list(undefined, true) }

  async find(id: string, publicOnly = false) {
    const jogador = await this.jogadores.findById(id)
    if (!jogador || (publicOnly && !jogador.ativo)) throw new AppError(404, 'NOT_FOUND', 'Jogador não encontrado')
    return jogador
  }

  create(input: unknown) { return this.jogadores.create(jogadorCreateSchema.parse(input)) }
  async update(id: string, input: unknown) {
    const data = jogadorUpdateSchema.parse(input)
    if (Object.keys(data).length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'Informe ao menos um campo')
    const jogador = await this.jogadores.update(id, data)
    if (!jogador) throw new AppError(404, 'NOT_FOUND', 'Jogador não encontrado')
    return jogador
  }
}

export const publicDto = ({ id, nome, apelido, ativo }: JogadorEntity) => ({ id, nome, apelido, ativo })
export const adminDto = (j: JogadorEntity) => ({
  id: j.id, nome: j.nome, apelido: j.apelido, telefone: j.telefone, ativo: j.ativo,
  createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(),
})
