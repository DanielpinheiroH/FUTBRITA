import { randomBytes } from 'node:crypto'

interface Session { adminId: string; expiresAt: number }

export class SessionStore {
  private readonly sessions = new Map<string, Session>()
  constructor(private readonly ttlMs = 8 * 60 * 60 * 1000) {}

  create(adminId: string) {
    const id = randomBytes(32).toString('base64url')
    this.sessions.set(id, { adminId, expiresAt: Date.now() + this.ttlMs })
    return id
  }

  get(id?: string) {
    if (!id) return null
    const session = this.sessions.get(id)
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(id)
      return null
    }
    return session
  }

  delete(id?: string) { if (id) this.sessions.delete(id) }
}
