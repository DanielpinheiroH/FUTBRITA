import { config as loadDotenv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

loadDotenv({ path: new URL('../../../.env', import.meta.url), quiet: true })

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const input = z.object({
  email: z.string().email(),
  password: z.string().min(12),
}).parse({
  email: argument('email') ?? process.env.ADMIN_EMAIL,
  password: argument('password') ?? process.env.NEW_ADMIN_PASSWORD,
})

const prisma = new PrismaClient()
try {
  const email = input.email.toLowerCase()
  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin) throw new Error(`Administrador não encontrado: ${email}`)
  await prisma.admin.update({ where: { email }, data: { senhaHash: await bcrypt.hash(input.password, 12) } })
  console.log(`Senha atualizada com sucesso para ${email}.`)
} finally {
  await prisma.$disconnect()
}
