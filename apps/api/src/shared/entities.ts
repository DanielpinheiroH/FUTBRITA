export interface AdminEntity {
  id: string
  nome: string
  email: string
  senhaHash: string
  ativo: boolean
}

export interface JogadorEntity {
  id: string
  nome: string
  apelido: string
  telefone: string
  fotoUrl: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}
