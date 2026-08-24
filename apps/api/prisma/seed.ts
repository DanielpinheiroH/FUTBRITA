import { config as loadDotenv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

loadDotenv({ path: new URL('../../../.env', import.meta.url), quiet: true })

const input = z.object({
  ADMIN_INITIAL_NAME: z.string().min(1).default('Administrador'),
  ADMIN_INITIAL_EMAIL: z.string().email(),
  ADMIN_INITIAL_PASSWORD: z.string().min(8),
}).parse(process.env)

const prisma = new PrismaClient()
try {
  const senhaHash = await bcrypt.hash(input.ADMIN_INITIAL_PASSWORD, 12)
  await prisma.admin.upsert({
    where: { email: input.ADMIN_INITIAL_EMAIL.toLowerCase() },
    update: { nome: input.ADMIN_INITIAL_NAME, ativo: true },
    create: { nome: input.ADMIN_INITIAL_NAME, email: input.ADMIN_INITIAL_EMAIL.toLowerCase(), senhaHash, ativo: true },
  })
  console.log('Administrador inicial disponível.')
} finally {
  await prisma.$disconnect()
}
