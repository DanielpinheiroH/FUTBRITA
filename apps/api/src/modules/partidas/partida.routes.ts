import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AdminRepository } from '../admins/admin.repository.js'
import type { SessionStore } from '../auth/session.store.js'
import { requireAdmin } from '../auth/require-admin.js'
import type { MatchRepository } from './partida.repository.js'
import { MatchService } from './partida.service.js'

const idParams = z.object({ id: z.string().uuid('Identificador inválido') })
export async function adminMatchRoutes(app: FastifyInstance, options: { matches: MatchRepository; admins: AdminRepository; sessions: SessionStore }) {
  const service = new MatchService(options.matches); app.addHook('preHandler', requireAdmin(options.admins, options.sessions))
  app.post('/rodadas/:id/partidas/iniciar', async (request, reply) => reply.status(201).send(await service.start(idParams.parse(request.params).id, request.adminId!)))
  app.get('/rodadas/:id/partidas', async (request) => service.list(idParams.parse(request.params).id))
  app.get('/rodadas/:id/partidas/atual', async (request) => service.current(idParams.parse(request.params).id))
  app.get('/partidas/:id', async (request) => service.find(idParams.parse(request.params).id))
  app.post('/partidas/:id/gols', async (request, reply) => reply.status(201).send(await service.addGoal(idParams.parse(request.params).id, request.body, request.adminId!)))
  app.patch('/gols/:id', async (request) => service.updateGoal(idParams.parse(request.params).id, request.body, request.adminId!))
  app.delete('/gols/:id', async (request) => service.removeGoal(idParams.parse(request.params).id, request.adminId!))
  app.post('/partidas/:id/finalizar', async (request) => service.finish(idParams.parse(request.params).id, request.adminId!))
}
