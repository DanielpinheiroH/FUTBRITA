/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../../services/api'

interface Admin { id: string; nome: string; email: string }
interface AuthContextValue { admin: Admin | null; loading: boolean; login: (email: string, senha: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setAdmin((await api<{ admin: Admin }>('/auth/me')).admin) } catch { setAdmin(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const login = async (email: string, senha: string) => setAdmin((await api<{ admin: Admin }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) })).admin)
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setAdmin(null) }
  return <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
