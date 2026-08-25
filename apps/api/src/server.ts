import { config as loadDotenv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from './app.js'
import { loadConfig } from './config/env.js'

loadDotenv({ path: new URL('../../../.env', import.meta.url), quiet: true })

const config = loadConfig()
const prisma = new PrismaClient()
const app = await buildApp(config, createPrismaDependencies(prisma))

const shutdown = async () => {
  app.log.info('Encerrando API com segurança')
  await app.close()
  await prisma.$disconnect()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  await prisma.$connect()
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  await shutdown()
  process.exit(1)
}
