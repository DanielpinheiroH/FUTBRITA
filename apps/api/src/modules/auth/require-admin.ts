import type { FastifyRequest } from 'fastify'
import type { AdminRepository } from '../admins/admin.repository.js'
import type { SessionStore } from './session.store.js'
import { AppError } from '../../shared/errors.js'

declare module 'fastify' {
  interface FastifyRequest { adminId?: string }
}

export function requireAdmin(admins: AdminRepository, sessions: SessionStore) {
  return async (request: FastifyRequest) => {
    const raw = request.cookies.fut_brita_session
    const sessionId = raw ? request.unsignCookie(raw).value ?? undefined : undefined
    const session = sessions.get(sessionId)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
    const admin = await admins.findById(session.adminId)
    if (!admin?.ativo) throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária')
    request.adminId = admin.id
  }
}
