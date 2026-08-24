import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AdminRepository } from '../admins/admin.repository.js'
import type { SessionStore } from '../auth/session.store.js'
import { requireAdmin } from '../auth/require-admin.js'
import type { GameRepository } from './jogo.repository.js'
import { GameService } from './jogo.service.js'

const params = z.object({ id: z.string().uuid('Identificador inválido') })
export async function adminGameRoutes(app: FastifyInstance, options: { games: GameRepository; admins: AdminRepository; sessions: SessionStore }) {
  const service = new GameService(options.games); app.addHook('preHandler', requireAdmin(options.admins, options.sessions))
  app.get('/rodadas/:id/chegadas', async (request) => service.arrivals(params.parse(request.params).id))
  app.post('/rodadas/:id/chegadas', async (request) => service.register(params.parse(request.params).id, request.body, request.adminId!))
  app.put('/rodadas/:id/chegadas/reordenar', async (request) => service.reorder(params.parse(request.params).id, request.body, request.adminId!))
  app.delete('/rodadas/:id/chegadas/:participacaoId', async (request) => { const parsed = z.object({ id: z.string().uuid(), participacaoId: z.string().uuid() }).parse(request.params); return service.remove(parsed.id, parsed.participacaoId, request.adminId!) })
  app.post('/rodadas/:id/formacao-inicial', async (request) => service.form(params.parse(request.params).id, request.adminId!))
  app.get('/rodadas/:id/estado-jogo', async (request) => service.state(params.parse(request.params).id))
  app.post('/rodadas/:id/rodizio', async (request) => service.rotate(params.parse(request.params).id, request.body, request.adminId!))
  app.patch('/participacoes/:id/saida', async (request) => service.exit(params.parse(request.params).id, request.adminId!))
}
