import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { StatisticsRepository } from './statistics.repository.js'
import { StatisticsService } from './statistics.service.js'

const idParams = z.object({ id: z.string().uuid('Identificador inválido') })
const filterSchema = z.object({ season: z.coerce.number().int().min(2000).max(2200).optional(), roundId: z.string().uuid().optional(), scope: z.enum(['all']).optional() }).refine((value) => !(value.season && value.roundId), 'Escolha temporada ou rodada')
const rankingSchema = filterSchema.and(z.object({ type: z.enum(['goals', 'wins', 'winRate', 'games', 'appearances', 'goalAverage', 'streak']).default('goals'), minGames: z.coerce.number().int().min(1).max(1000).default(1) }))

export async function publicStatisticsRoutes(app: FastifyInstance, options: { statistics: StatisticsRepository }) {
  const service = new StatisticsService(options.statistics)
  app.get('/jogadores/:id/estatisticas', async (request) => { const filter = filterSchema.parse(request.query); return service.player(idParams.parse(request.params).id, { season: filter.season, roundId: filter.roundId }) })
  app.get('/rankings', async (request) => { const query = rankingSchema.parse(request.query); return service.ranking(query.type, { season: query.season, roundId: query.roundId }, query.minGames) })
  app.get('/rodadas/:id/resumo', async (request) => service.roundSummary(idParams.parse(request.params).id))
  app.get('/historico', async () => service.history())
  app.get('/historico/:id', async (request) => service.roundSummary(idParams.parse(request.params).id, true))
  app.get('/estatisticas/temporadas', async () => service.seasons())
  app.get('/estatisticas/resumo', async () => service.publicSummary())
}
