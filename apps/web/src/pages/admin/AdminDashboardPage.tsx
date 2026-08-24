import { ArrowRight, UserCheck, UserX, Users } from 'lucide-react'
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
  return <div className="page-shell py-7 sm:py-10"><p className="text-sm font-bold text-brita-500">PAINEL ADMINISTRATIVO</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Olá, {admin?.nome.split(' ')[0]}</h1><p className="mt-2 text-neutral-500">Aqui está o resumo da base de jogadores.</p>{error ? <div className="mt-7"><ErrorState message={error} retry={load} /></div> : !players ? <Loading /> : <><div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><article className="surface p-5"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><UserCheck /></span><p className="mt-5 text-3xl font-black">{players.filter((p) => p.ativo).length}</p><p className="mt-1 text-sm text-neutral-500">Jogadores ativos</p></article><article className="surface p-5"><span className="grid size-11 place-items-center rounded-xl bg-neutral-500/10 text-neutral-400"><UserX /></span><p className="mt-5 text-3xl font-black">{players.filter((p) => !p.ativo).length}</p><p className="mt-1 text-sm text-neutral-500">Jogadores inativos</p></article><article className="surface p-5 sm:col-span-2 xl:col-span-1"><span className="grid size-11 place-items-center rounded-xl bg-brita-500/10 text-brita-500"><Users /></span><p className="mt-5 text-3xl font-black">{players.length}</p><p className="mt-1 text-sm text-neutral-500">Total cadastrado</p></article></div><Link to="/admin/jogadores" className="surface mt-5 flex min-h-20 items-center justify-between gap-4 p-5 transition hover:border-brita-500/30"><span><strong className="block">Gerenciar jogadores</strong><span className="mt-1 block text-sm text-neutral-500">Cadastrar, editar, ativar ou inativar</span></span><ArrowRight className="shrink-0 text-brita-500" /></Link></>}</div>
}
