import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { buildApp, createPrismaDependencies } from '../src/app.js'

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true'

describe.skipIf(!enabled)('Integração PostgreSQL real', () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  let jogadorId: string | undefined

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    app = await buildApp(
      {
        SESSION_SECRET: process.env.SESSION_SECRET!,
        NODE_ENV: 'test',
        WEB_ORIGIN: 'http://localhost:5173',
      },
      createPrismaDependencies(prisma),
    )
  })

  afterAll(async () => {
    if (jogadorId) await prisma.jogador.deleteMany({ where: { id: jogadorId } })
    await app.close()
    await prisma.$disconnect()
  })

  it('valida health, autenticação e fluxo principal de jogadores no banco real', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)
    expect(health.json()).toEqual({ status: 'ok', database: 'connected' })

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.INTEGRATION_ADMIN_EMAIL,
        senha: process.env.INTEGRATION_ADMIN_PASSWORD,
      },
    })
    expect(login.statusCode).toBe(200)
    const cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join('; ')

    const suffix = Date.now().toString()
    const fotoUrl = 'data:image/webp;base64,aW50ZWdyYWNhbw=='
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/jogadores',
      headers: { cookie },
      payload: { nome: `Integração PostgreSQL ${suffix}`, apelido: `PG${suffix}`, telefone: '(61) 99999-9999', fotoUrl },
    })
    expect(created.statusCode).toBe(201)
    jogadorId = created.json().id
    expect(created.json()).toMatchObject({ ativo: true, telefone: '61999999999', fotoUrl })
    expect((await prisma.jogador.findUniqueOrThrow({ where: { id: jogadorId }, select: { fotoUrl: true } })).fotoUrl).toBe(fotoUrl)

    const listed = await app.inject({ method: 'GET', url: `/api/admin/jogadores?q=pg${suffix}`, headers: { cookie } })
    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toHaveLength(1)
    expect(listed.json()[0].fotoUrl).toBe(fotoUrl)

    const publicWithPhoto = await app.inject({ method: 'GET', url: `/api/public/jogadores/${jogadorId}` })
    expect(publicWithPhoto.statusCode).toBe(200)
    expect(publicWithPhoto.json().fotoUrl).toBe(fotoUrl)

    const edited = await app.inject({ method: 'PATCH', url: `/api/admin/jogadores/${jogadorId}`, headers: { cookie }, payload: { nome: `Integração editada ${suffix}`, fotoUrl: null } })
    expect(edited.statusCode).toBe(200)
    expect(edited.json().nome).toBe(`Integração editada ${suffix}`)
    expect(edited.json().fotoUrl).toBeNull()

    const publicBefore = await app.inject({ method: 'GET', url: `/api/public/jogadores/${jogadorId}` })
    expect(publicBefore.statusCode).toBe(200)
    expect(publicBefore.body).not.toContain('telefone')
    expect(publicBefore.body).not.toContain('61999999999')

    const inactive = await app.inject({ method: 'PATCH', url: `/api/admin/jogadores/${jogadorId}`, headers: { cookie }, payload: { ativo: false } })
    expect(inactive.statusCode).toBe(200)
    expect(inactive.json().ativo).toBe(false)

    const publicAfter = await app.inject({ method: 'GET', url: `/api/public/jogadores/${jogadorId}` })
    expect(publicAfter.statusCode).toBe(404)

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })
    expect(logout.statusCode).toBe(204)
    const denied = await app.inject({ method: 'GET', url: '/api/admin/jogadores', headers: { cookie } })
    expect(denied.statusCode).toBe(401)
  })
})
