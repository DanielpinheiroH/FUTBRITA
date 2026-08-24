import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Dados inválidos',
        details: error.flatten().fieldErrors,
      })
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      })
    }
    app.log.error(error)
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
  })
}
