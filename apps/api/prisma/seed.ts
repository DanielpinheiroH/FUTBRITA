import { config as loadDotenv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

loadDotenv({ path: new URL('../../../.env', import.meta.url), quiet: true })

const input = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_1_NAME: z.string().min(1).optional(),
  ADMIN_1_EMAIL: z.string().email().optional(),
  ADMIN_1_PASSWORD: z.string().min(12).optional(),
  ADMIN_2_NAME: z.string().min(1).optional(),
  ADMIN_2_EMAIL: z.string().email().optional(),
  ADMIN_2_PASSWORD: z.string().min(12).optional(),
  ADMIN_INITIAL_NAME: z.string().min(1).optional(),
  ADMIN_INITIAL_EMAIL: z.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
}).parse(process.env)

const admins = [
  {
    nome: input.ADMIN_1_NAME ?? input.ADMIN_INITIAL_NAME ?? 'Administrador 1',
    email: input.ADMIN_1_EMAIL ?? input.ADMIN_INITIAL_EMAIL,
    senha: input.ADMIN_1_PASSWORD ?? input.ADMIN_INITIAL_PASSWORD,
  },
  { nome: input.ADMIN_2_NAME ?? 'Administrador 2', email: input.ADMIN_2_EMAIL, senha: input.ADMIN_2_PASSWORD },
].filter((admin): admin is { nome: string; email: string; senha: string } => Boolean(admin.email && admin.senha))

if (input.NODE_ENV === 'production' && admins.length !== 2) {
  throw new Error('Produção exige ADMIN_1_EMAIL/PASSWORD e ADMIN_2_EMAIL/PASSWORD.')
}
if (!admins.length) throw new Error('Configure ao menos um administrador inicial.')
if (new Set(admins.map((admin) => admin.email.toLowerCase())).size !== admins.length) {
  throw new Error('Os e-mails dos administradores iniciais devem ser diferentes.')
}

const prisma = new PrismaClient()
try {
  let created = 0
  let existing = 0
  for (const admin of admins) {
    const email = admin.email.toLowerCase()
    const current = await prisma.admin.findUnique({ where: { email } })
    if (current) {
      await prisma.admin.update({ where: { email }, data: { nome: admin.nome, ativo: true } })
      existing++
      continue
    }
    await prisma.admin.create({
      data: { nome: admin.nome, email, senhaHash: await bcrypt.hash(admin.senha, 12), ativo: true },
    })
    created++
  }
  console.log(`Administradores iniciais disponíveis: ${admins.length} (${created} criado(s), ${existing} existente(s)).`)
} finally {
  await prisma.$disconnect()
}
