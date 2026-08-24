import { ArrowRight, BarChart3, CalendarDays, UserCheck, UserX, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JogadorAdmin } from '@fut-brita/shared'
import { api } from '../../services/api'
import { ErrorState, Loading } from '../../components/ui/States'
import { useAuth } from '../../features/auth/AuthContext'

export function AdminDashboardPage() {
  const { admin } = useAuth(); const [players, setPlayers] = useState<JogadorAdmin[] | null>(null); const [error, setError] = useState('')
  const load = async () => { setError(''); try { setPlayers(await api('/admin/jogadores')) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o resumo') } }
  useEffect(() => { void load() }, [])
  return <div className="page-shell py-7 sm:py-10"><p className="text-sm font-bold text-brita-500">PAINEL ADMINISTRATIVO</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Olá, {admin?.nome.split(' ')[0]}</h1><p className="mt-2 text-neutral-500">Aqui está o resumo da base de jogadores.</p>{error ? <div className="mt-7"><ErrorState message={error} retry={load}/></div> : !players ? <Loading/> : <><div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Summary icon={UserCheck} value={players.filter((player) => player.ativo).length} label="Jogadores ativos" color="text-emerald-400 bg-emerald-500/10"/><Summary icon={UserX} value={players.filter((player) => !player.ativo).length} label="Jogadores inativos" color="text-neutral-400 bg-neutral-500/10"/><Summary icon={Users} value={players.length} label="Total cadastrado" color="text-brita-500 bg-brita-500/10"/></div><div className="mt-5 grid gap-3 lg:grid-cols-3"><Action to="/admin/rodadas" icon={CalendarDays} title="Organizar rodada" text="Presença, tipo e pagamentos"/><Action to="/admin/jogadores" icon={Users} title="Gerenciar jogadores" text="Cadastrar, editar, ativar ou inativar"/><Action to="/rankings" icon={BarChart3} title="Consultar estatísticas" text="Rankings e histórico esportivo"/></div></>}</div>
}
function Summary({ icon: Icon, value, label, color }: { icon: typeof Users; value: number; label: string; color: string }) { return <article className="surface p-5"><span className={`grid size-11 place-items-center rounded-xl ${color}`}><Icon/></span><p className="mt-5 text-3xl font-black">{value}</p><p className="mt-1 text-sm text-neutral-500">{label}</p></article> }
function Action({ to, icon: Icon, title, text }: { to: string; icon: typeof Users; title: string; text: string }) { return <Link to={to} className="surface flex min-h-24 items-center justify-between gap-4 p-5 transition hover:border-brita-500/30"><span className="flex min-w-0 items-center gap-3"><Icon className="shrink-0 text-brita-500"/><span><strong className="block">{title}</strong><span className="mt-1 block text-sm text-neutral-500">{text}</span></span></span><ArrowRight className="shrink-0 text-brita-500"/></Link> }
