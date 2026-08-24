import { ArrowRight, Search, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JogadorPublico } from '@fut-brita/shared'
import { api } from '../../services/api'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'

export function JogadoresPage() {
  const [players, setPlayers] = useState<JogadorPublico[]>([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = async () => { setLoading(true); setError(''); try { setPlayers(await api('/public/jogadores')) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os jogadores') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => { const q = query.trim().toLocaleLowerCase('pt-BR'); return q ? players.filter((p) => p.nome.toLocaleLowerCase('pt-BR').includes(q) || p.apelido.toLocaleLowerCase('pt-BR').includes(q)) : players }, [players, query])
  return <section className="page-shell min-h-[75svh] py-10 sm:py-16"><div className="max-w-2xl"><span className="text-xs font-bold uppercase tracking-[.2em] text-brita-500">Nossa turma</span><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Jogadores</h1><p className="mt-3 text-neutral-400">Quem faz a quarta-feira acontecer.</p></div><div className="relative mt-8 max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} /><label htmlFor="public-search" className="sr-only">Buscar jogador</label><input id="public-search" value={query} onChange={(e) => setQuery(e.target.value)} className="field pl-12" placeholder="Buscar por nome ou apelido" /></div><div className="mt-7">{loading ? <Loading /> : error ? <ErrorState message={error} retry={load} /> : filtered.length === 0 ? <EmptyState title="Nenhum jogador encontrado" description={query ? 'Tente buscar com outro nome ou apelido.' : 'Os jogadores ativos aparecerão aqui.'} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((player) => <Link to={`/jogadores/${player.id}`} key={player.id} className="surface flex min-h-24 items-center gap-4 p-4 transition hover:border-brita-500/30"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brita-500/10 text-brita-500"><UserRound /></span><span className="min-w-0 flex-1"><strong className="block truncate text-base">{player.apelido}</strong><span className="block truncate text-sm text-neutral-500">{player.nome}</span></span><ArrowRight className="shrink-0 text-neutral-600" size={20} /></Link>)}</div>}</div></section>
}
