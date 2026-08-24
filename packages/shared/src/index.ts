import { z } from 'zod'

const telefone = z.string().trim().transform((value) => value.replace(/\D/g, '')).pipe(
  z.string().regex(/^(?:55)?[1-9]{2}9?\d{8}$/, 'Telefone brasileiro inválido'),
)

export const jogadorCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  apelido: z.string().trim().min(1, 'Apelido é obrigatório').max(60),
  telefone,
})

export const jogadorUpdateSchema = jogadorCreateSchema.partial().extend({ ativo: z.boolean().optional() })

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').transform((value) => value.toLowerCase()),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export type JogadorCreateInput = z.input<typeof jogadorCreateSchema>
export type JogadorUpdateInput = z.input<typeof jogadorUpdateSchema>

export interface JogadorPublico {
  id: string
  nome: string
  apelido: string
  ativo: boolean
}

export interface JogadorAdmin extends JogadorPublico {
  telefone: string
  createdAt: string
  updatedAt: string
}

export interface ApiErrorResponse {
  error: string
  message: string
  details?: unknown
}
