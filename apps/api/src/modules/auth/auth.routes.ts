import type { FastifyInstance } from 'fastify'
import { loginSchema } from '@fut-brita/shared'
import type { AdminRepository } from '../admins/admin.repository.js'
import { AuthService } from './auth.service.js'
import type { SessionStore } from './session.store.js'
import { AppError } from '../../shared/errors.js'

export interface AuthRouteOptions {
  admins: AdminRepository
  sessions: SessionStore
  cookieSecure: boolean
}

export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions) {
  const service = new AuthService(options.admins)
  const cookie = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: options.cookieSecure, signed: true, maxAge: 8 * 60 * 60 }

  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const admin = await service.login(input.email, input.senha)
    const sessionId = options.sessions.create(admin.id)
    return reply.setCookie('fut_brita_session', sessionId, cookie).send({ admin: { id: admin.id, nome: admin.nome, email: admin.email } })
  })

  app.post('/logout', async (request, reply) => {
    const raw = request.cookies.fut_brita_session
    const sessionId = raw ? request.unsignCookie(raw).value ?? undefined : undefined
    options.sessions.delete(sessionId)
    return reply.clearCookie('fut_brita_session', { path: '/' }).status(204).send()
  })

  app.get('/me', async (request) => {
    const raw = request.cookies.fut_brita_session
    const sessionId = raw ? request.unsignCookie(raw).value ?? undefined : undefined
    const session = options.sessions.get(sessionId)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
    const admin = await options.admins.findById(session.adminId)
    if (!admin || !admin.ativo) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
    return { admin: { id: admin.id, nome: admin.nome, email: admin.email } }
  })
}
