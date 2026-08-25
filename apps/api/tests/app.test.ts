import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp, type AppDependencies } from '../src/app.js'
import type { AdminRepository } from '../src/modules/admins/admin.repository.js'
import type { JogadorCreateData, JogadorRepository, JogadorUpdateData } from '../src/modules/jogadores/jogador.repository.js'
import { SessionStore } from '../src/modules/auth/session.store.js'
import type { AdminEntity, JogadorEntity } from '../src/shared/entities.js'

class MemoryAdmins implements AdminRepository {
  constructor(public data: AdminEntity[]) {}
  async findByEmail(email: string) { return this.data.find((a) => a.email === email) ?? null }
  async findById(id: string) { return this.data.find((a) => a.id === id) ?? null }
}
class MemoryJogadores implements JogadorRepository {
  data: JogadorEntity[] = []
  async list(search?: string, onlyActive = false) { const q = search?.toLowerCase(); return this.data.filter((p) => (!onlyActive || p.ativo) && (!q || p.nome.toLowerCase().includes(q) || p.apelido.toLowerCase().includes(q))) }
  async findById(id: string) { return this.data.find((p) => p.id === id) ?? null }
  async create(input: JogadorCreateData) { const now = new Date(); const jogador = { id: randomUUID(), ...input, ativo: true, createdAt: now, updatedAt: now }; this.data.push(jogador); return jogador }
  async update(id: string, input: JogadorUpdateData) { const jogador = this.data.find((p) => p.id === id); if (!jogador) return null; Object.assign(jogador, input, { updatedAt: new Date() }); return jogador }
}

describe('API Fut Brita', () => {
  let app: FastifyInstance
  let jogadores: MemoryJogadores
  const password = 'SenhaForte123!'
  beforeEach(async () => {
    jogadores = new MemoryJogadores()
    const admins = new MemoryAdmins([{ id: randomUUID(), nome: 'Admin', email: 'admin@futbrita.test', senhaHash: await bcrypt.hash(password, 4), ativo: true }])
    const deps: AppDependencies = { admins, jogadores, sessions: new SessionStore(), databaseCheck: async () => undefined }
    app = await buildApp({ SESSION_SECRET: 'segredo-de-testes-com-mais-de-32-caracteres', NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }, deps)
  })
  afterEach(async () => { await app.close() })

  async function login() {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: password } })
    return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  }
  async function create(cookie: string, data = { nome: 'Daniel Pinheiro', apelido: 'Dani', telefone: '(61) 99999-9999' }) {
    return app.inject({ method: 'POST', url: '/api/admin/jogadores', headers: { cookie }, payload: data })
  }

  it('realiza login com credenciais corretas', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ADMIN@FUTBRITA.TEST', senha: password } })
    expect(response.statusCode).toBe(200); expect(response.cookies[0]?.name).toBe('fut_brita_session'); expect(response.json().admin.email).toBe('admin@futbrita.test')
  })
  it('usa cookie cross-site seguro em produção', async () => {
    await app.close()
    const admins = new MemoryAdmins([{ id: randomUUID(), nome: 'Admin', email: 'admin@futbrita.test', senhaHash: await bcrypt.hash(password, 4), ativo: true }])
    app = await buildApp(
      { SESSION_SECRET: 'segredo-de-testes-com-mais-de-32-caracteres', NODE_ENV: 'production', WEB_ORIGIN: 'https://futbrita-api.vercel.app' },
      { admins, jogadores, sessions: new SessionStore(), databaseCheck: async () => undefined },
    )
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: password } })
    const header = response.headers['set-cookie']
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Secure')
    expect(header).toContain('SameSite=None')
  })
  it('expõe CORS credenciado apenas para a origem configurada', async () => {
    const allowed = await app.inject({ method: 'OPTIONS', url: '/api/auth/me', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' } })
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    const denied = await app.inject({ method: 'OPTIONS', url: '/api/auth/me', headers: { origin: 'https://origem-invalida.example', 'access-control-request-method': 'GET' } })
    expect(denied.statusCode).toBe(403)
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })
  it('limita tentativas repetidas de login', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: 'senha-incorreta' } })
      expect(response.statusCode).toBe(401)
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: 'senha-incorreta' } })
    expect(blocked.statusCode).toBe(429)
  })
  it('rejeita login incorreto', async () => { const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@futbrita.test', senha: 'errada' } }); expect(response.statusCode).toBe(401); expect(response.json().error).toBe('INVALID_CREDENTIALS') })
  it('protege rota administrativa sem login', async () => { const response = await app.inject({ method: 'GET', url: '/api/admin/jogadores' }); expect(response.statusCode).toBe(401) })
  it('encerra a sessão no logout', async () => { const cookie = await login(); const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } }); expect(logout.statusCode).toBe(204); const denied = await app.inject({ method: 'GET', url: '/api/admin/jogadores', headers: { cookie } }); expect(denied.statusCode).toBe(401) })
  it('cria jogador ativo e normaliza telefone', async () => { const response = await create(await login()); expect(response.statusCode).toBe(201); expect(response.json()).toMatchObject({ nome: 'Daniel Pinheiro', apelido: 'Dani', telefone: '61999999999', ativo: true }) })
  it('lista e pesquisa jogadores sem diferenciar maiúsculas', async () => { const cookie = await login(); await create(cookie); await create(cookie, { nome: 'Carlos Silva', apelido: 'Kadu', telefone: '61988887777' }); const response = await app.inject({ method: 'GET', url: '/api/admin/jogadores?q=DAN', headers: { cookie } }); expect(response.statusCode).toBe(200); expect(response.json()).toHaveLength(1); expect(response.json()[0].apelido).toBe('Dani') })
  it('edita jogador', async () => { const cookie = await login(); const created = await create(cookie); const response = await app.inject({ method: 'PATCH', url: `/api/admin/jogadores/${created.json().id}`, headers: { cookie }, payload: { apelido: 'Brita' } }); expect(response.statusCode).toBe(200); expect(response.json().apelido).toBe('Brita') })
  it('inativa jogador sem excluí-lo', async () => { const cookie = await login(); const created = await create(cookie); const response = await app.inject({ method: 'PATCH', url: `/api/admin/jogadores/${created.json().id}`, headers: { cookie }, payload: { ativo: false } }); expect(response.statusCode).toBe(200); expect(response.json().ativo).toBe(false); expect(jogadores.data).toHaveLength(1) })
  it('impede criação sem nome', async () => { const response = await create(await login(), { nome: '', apelido: 'Dani', telefone: '61999999999' }); expect(response.statusCode).toBe(400); expect(response.json().error).toBe('VALIDATION_ERROR') })
  it('impede criação sem apelido', async () => { const response = await create(await login(), { nome: 'Daniel', apelido: '', telefone: '61999999999' }); expect(response.statusCode).toBe(400); expect(response.json().error).toBe('VALIDATION_ERROR') })
  it('nunca expõe telefone na API pública', async () => { const cookie = await login(); await create(cookie); const response = await app.inject({ method: 'GET', url: '/api/public/jogadores' }); expect(response.statusCode).toBe(200); expect(response.json()[0]).toEqual(expect.objectContaining({ nome: 'Daniel Pinheiro', apelido: 'Dani' })); expect(response.body).not.toContain('telefone'); expect(response.body).not.toContain('61999999999') })
})
