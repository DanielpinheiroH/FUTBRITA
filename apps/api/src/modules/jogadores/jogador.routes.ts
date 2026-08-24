import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { AdminRepository } from '../admins/admin.repository.js'
import type { SessionStore } from '../auth/session.store.js'
import type { JogadorRepository } from './jogador.repository.js'
import { JogadorService, adminDto, publicDto } from './jogador.service.js'
import { AppError } from '../../shared/errors.js'

const paramsSchema = z.object({ id: z.string().uuid('Identificador inválido') })
const querySchema = z.object({ q: z.string().max(120).optional() })

export interface JogadorRouteOptions { jogadores: JogadorRepository; admins: AdminRepository; sessions: SessionStore }

function requireAdmin(options: JogadorRouteOptions) {
  return async (request: FastifyRequest) => {
    const raw = request.cookies.fut_brita_session
    const sessionId = raw ? request.unsignCookie(raw).value ?? undefined : undefined
    const session = options.sessions.get(sessionId)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
    const admin = await options.admins.findById(session.adminId)
    if (!admin?.ativo) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
  }
}

export async function adminJogadorRoutes(app: FastifyInstance, options: JogadorRouteOptions) {
  const service = new JogadorService(options.jogadores)
  const preHandler = requireAdmin(options)
  app.addHook('preHandler', preHandler)
  app.get('/', async (request) => (await service.list(querySchema.parse(request.query).q)).map(adminDto))
  app.get('/:id', async (request) => adminDto(await service.find(paramsSchema.parse(request.params).id)))
  app.post('/', async (request, reply) => reply.status(201).send(adminDto(await service.create(request.body))))
  app.patch('/:id', async (request) => adminDto(await service.update(paramsSchema.parse(request.params).id, request.body)))
}

export async function publicJogadorRoutes(app: FastifyInstance, options: { jogadores: JogadorRepository }) {
  const service = new JogadorService(options.jogadores)
  app.get('/', async () => (await service.listPublic()).map(publicDto))
  app.get('/:id', async (request) => publicDto(await service.find(paramsSchema.parse(request.params).id, true)))
}
