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
import { PrismaRodadaRepository, type RodadaRepository } from './modules/rodadas/rodada.repository.js'
import { adminRodadaRoutes, publicRodadaRoutes } from './modules/rodadas/rodada.routes.js'
import { PrismaGameRepository, type GameRepository } from './modules/jogo/jogo.repository.js'
import { adminGameRoutes } from './modules/jogo/jogo.routes.js'
import { PrismaMatchRepository, type MatchRepository } from './modules/partidas/partida.repository.js'
import { adminMatchRoutes } from './modules/partidas/partida.routes.js'
import { PrismaStatisticsRepository, type StatisticsRepository } from './modules/statistics/statistics.repository.js'
import { publicStatisticsRoutes } from './modules/statistics/statistics.routes.js'

export interface AppDependencies {
  admins: AdminRepository
  jogadores: JogadorRepository
  sessions: SessionStore
  databaseCheck: () => Promise<void>
  rodadas?: RodadaRepository
  games?: GameRepository
  matches?: MatchRepository
  statistics?: StatisticsRepository
}

export function createPrismaDependencies(prisma: PrismaClient): AppDependencies {
  return {
    admins: new PrismaAdminRepository(prisma),
    jogadores: new PrismaJogadorRepository(prisma),
    sessions: new SessionStore(),
    databaseCheck: async () => { await prisma.$queryRaw`SELECT 1` },
    rodadas: new PrismaRodadaRepository(prisma),
    games: new PrismaGameRepository(prisma),
    matches: new PrismaMatchRepository(prisma),
    statistics: new PrismaStatisticsRepository(prisma),
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
  if (dependencies.rodadas) {
    await app.register(adminRodadaRoutes, { prefix: '/api/admin', rodadas: dependencies.rodadas, admins: dependencies.admins, sessions: dependencies.sessions })
    await app.register(publicRodadaRoutes, { prefix: '/api/public/rodadas', rodadas: dependencies.rodadas, games: dependencies.games, matches: dependencies.matches })
  }
  if (dependencies.games) await app.register(adminGameRoutes, { prefix: '/api/admin', games: dependencies.games, admins: dependencies.admins, sessions: dependencies.sessions })
  if (dependencies.matches) await app.register(adminMatchRoutes, { prefix: '/api/admin', matches: dependencies.matches, admins: dependencies.admins, sessions: dependencies.sessions })
  if (dependencies.statistics) await app.register(publicStatisticsRoutes, { prefix: '/api/public', statistics: dependencies.statistics })
  return app
}
