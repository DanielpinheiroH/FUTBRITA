import { ArrowRight, CalendarDays, Plus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RodadaListaItem } from '@fut-brita/shared'
import { api } from '../../services/api'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { dateBr, money, statusClass, statusLabel } from '../../utils/format'

export function AdminRodadasPage() {
  const [rounds, setRounds] = useState<RodadaListaItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRounds(await api('/admin/rodadas')) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar as rodadas') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const upcoming = useMemo(() => rounds.filter((r) => r.status === 'PLANEJADA' || r.status === 'PREPARACAO'), [rounds])
  const recent = useMemo(() => rounds.filter((r) => r.status !== 'PLANEJADA' && r.status !== 'PREPARACAO'), [rounds])
  const cards = (items: RodadaListaItem[]) => <div className="grid gap-3 lg:grid-cols-2">{items.map((round) => <Link key={round.id} to={`/admin/rodadas/${round.id}`} className="surface flex min-h-32 items-center gap-4 p-5 transition hover:border-brita-500/30"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brita-500/10 text-brita-500"><CalendarDays /></span><span className="min-w-0 flex-1"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass[round.status]}`}>{statusLabel[round.status]}</span><strong className="mt-2 block capitalize">{dateBr(round.data)}</strong><span className="mt-1 flex flex-wrap gap-x-3 text-sm text-neutral-500"><span>{round.horario}</span><span>{money(round.valorJogadorLinha)}</span><span className="inline-flex items-center gap-1"><Users size={14} />{round.totalParticipantes}</span></span></span><ArrowRight className="shrink-0 text-neutral-600" /></Link>)}</div>
  return <div className="page-shell py-7 sm:py-10"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-brita-500">QUARTAS-FEIRAS</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Rodadas</h1><p className="mt-2 text-neutral-500">Planeje participantes e acompanhe o financeiro.</p></div><Link to="/admin/rodadas/nova" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brita-500 px-5 font-bold text-black shadow-glow sm:w-auto"><Plus size={20} />Nova rodada</Link></div>{loading ? <Loading /> : error ? <div className="mt-7"><ErrorState message={error} retry={load} /></div> : rounds.length === 0 ? <div className="mt-7"><EmptyState title="Nenhuma rodada criada" description="Crie a próxima quarta-feira para começar a organizar a turma." /></div> : <div className="mt-8 space-y-10">{upcoming.length > 0 && <section><h2 className="mb-4 text-lg font-extrabold">Próximas rodadas</h2>{cards(upcoming)}</section>}{recent.length > 0 && <section><h2 className="mb-4 text-lg font-extrabold">Rodadas recentes</h2>{cards(recent)}</section>}</div>}</div>
}
