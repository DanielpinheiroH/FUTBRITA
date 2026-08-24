import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import type { AppConfig } from './config/env.js'
import { PrismaAdminRepository, type AdminRepository } from './modules/admins/admin.repository.js'
import { PrismaJogadorRepository, type JogadorRepository } from './modules/jogadores/jogador.repository.js'
import { SessionStore } from './modules/auth/session.store.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { adminJogadorRoutes, publicJogadorRoutes } from './modules/jogadores/jogador.routes.js'
import { registerErrorHandler } from './shared/errors.js'

export interface AppDependencies {
  admins: AdminRepository
  jogadores: JogadorRepository
  sessions: SessionStore
  databaseCheck: () => Promise<void>
}

export function createPrismaDependencies(prisma: PrismaClient): AppDependencies {
  return {
    admins: new PrismaAdminRepository(prisma),
    jogadores: new PrismaJogadorRepository(prisma),
    sessions: new SessionStore(),
    databaseCheck: async () => { await prisma.$queryRaw`SELECT 1` },
  }
}

export async function buildApp(config: Pick<AppConfig, 'SESSION_SECRET' | 'NODE_ENV' | 'WEB_ORIGIN'>, dependencies: AppDependencies) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' })
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true })
  await app.register(cookie, { secret: config.SESSION_SECRET, hook: 'onRequest' })
  registerErrorHandler(app)
  app.get('/api/health', async (_request, reply) => {
    try {
      await dependencies.databaseCheck()
      return { status: 'ok', database: 'connected' }
    } catch {
      return reply.status(503).send({ status: 'degraded', database: 'disconnected' })
    }
  })
  await app.register(authRoutes, { prefix: '/api/auth', admins: dependencies.admins, sessions: dependencies.sessions, cookieSecure: config.NODE_ENV === 'production' })
  await app.register(adminJogadorRoutes, { prefix: '/api/admin/jogadores', ...dependencies })
  await app.register(publicJogadorRoutes, { prefix: '/api/public/jogadores', jogadores: dependencies.jogadores })
  return app
}
