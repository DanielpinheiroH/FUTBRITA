import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AdminRepository } from '../admins/admin.repository.js'
import type { SessionStore } from '../auth/session.store.js'
import { requireAdmin } from '../auth/require-admin.js'
import type { RodadaRepository } from './rodada.repository.js'
import { RodadaService, rodadaAdminDto } from './rodada.service.js'
import type { GameRepository } from '../jogo/jogo.repository.js'
import { gameStateDto } from '../jogo/jogo.service.js'
import type { MatchRepository } from '../partidas/partida.repository.js'
import { matchDto } from '../partidas/partida.service.js'

const idSchema = z.object({ id: z.string().uuid('Identificador inválido') })
export interface RodadaRouteOptions { rodadas: RodadaRepository; admins: AdminRepository; sessions: SessionStore }

export async function adminRodadaRoutes(app: FastifyInstance, options: RodadaRouteOptions) {
  const service = new RodadaService(options.rodadas)
  app.addHook('preHandler', requireAdmin(options.admins, options.sessions))
  app.get('/rodadas', async () => service.list())
  app.get('/rodadas/:id', async (request) => rodadaAdminDto(await service.find(idSchema.parse(request.params).id)))
  app.post('/rodadas', async (request, reply) => reply.status(201).send(await service.create(request.body, request.adminId!)))
  app.patch('/rodadas/:id', async (request) => service.update(idSchema.parse(request.params).id, request.body))
  app.post('/rodadas/:id/participantes', async (request, reply) => reply.status(201).send(await service.addParticipacao(idSchema.parse(request.params).id, request.body, request.adminId!)))
  app.post('/rodadas/:id/participantes/novo-jogador', async (request, reply) => reply.status(201).send(await service.addJogadorRapido(idSchema.parse(request.params).id, request.body, request.adminId!)))
  app.patch('/participacoes/:id', async (request) => service.updateParticipacao(idSchema.parse(request.params).id, request.body, request.adminId!))
  app.delete('/participacoes/:id', async (request) => service.removeParticipacao(idSchema.parse(request.params).id))
  app.get('/rodadas/:id/financeiro', async (request) => service.financial(idSchema.parse(request.params).id))
  app.patch('/pagamentos/:id', async (request) => service.updatePagamento(idSchema.parse(request.params).id, request.body, request.adminId!))
}

export async function publicRodadaRoutes(app: FastifyInstance, options: { rodadas: RodadaRepository; games?: GameRepository; matches?: MatchRepository }) {
  const service = new RodadaService(options.rodadas)
  app.get('/atual', async () => { const round = await service.currentPublic(); if (!round) return null; const game = options.games ? gameStateDto(await options.games.state(round.id)) : undefined; const currentMatch = options.matches ? await options.matches.current(round.id) : null; return { ...round, ...(options.games ? { estadoJogo: game } : {}), ...(options.matches ? { partidaAtual: currentMatch ? matchDto(currentMatch) : null } : {}) } })
  app.get('/:id', async (request) => { const round = await service.publicById(idSchema.parse(request.params).id); const game = options.games ? gameStateDto(await options.games.state(round.id)) : undefined; const currentMatch = options.matches ? await options.matches.current(round.id) : null; return { ...round, ...(options.games ? { estadoJogo: game } : {}), ...(options.matches ? { partidaAtual: currentMatch ? matchDto(currentMatch) : null } : {}) } })
}
