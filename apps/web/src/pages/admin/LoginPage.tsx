import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../features/auth/AuthContext'

export function LoginPage() {
  const { admin, login } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  if (admin) return <Navigate to="/admin" replace />
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await login(email, senha); const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname; navigate(from ?? '/admin', { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar') } finally { setLoading(false) } }
  return <main className="noise grid min-h-svh place-items-center overflow-x-hidden bg-neutral-950 p-4 text-white"><section className="w-full max-w-md"><Link to="/" className="mb-5 inline-flex min-h-12 items-center gap-2 text-sm font-bold text-neutral-400"><ArrowLeft size={19} />Voltar ao site</Link><div className="surface p-5 sm:p-8"><span className="grid size-14 place-items-center rounded-2xl bg-brita-500 text-black"><LockKeyhole /></span><h1 className="mt-6 text-3xl font-black tracking-tight">Área administrativa</h1><p className="mt-2 text-sm leading-relaxed text-neutral-400">Entre com suas credenciais para gerenciar o Fut Brita.</p>{error && <div role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}<form onSubmit={submit} className="mt-7 space-y-5"><Input label="E-mail" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input label="Senha" name="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /><Button type="submit" className="w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no painel'}</Button></form></div></section></main>
}
