import { Award, CalendarRange, Medal, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HistoricoRodadaItem, RankingPublico, RankingType } from '@fut-brita/shared'
import { api } from '../../services/api'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { shortDate } from '../../utils/format'

const types: Array<{ value: RankingType; label: string }> = [
  { value: 'goals', label: 'Artilharia' }, { value: 'wins', label: 'Vitórias' },
  { value: 'winRate', label: 'Aproveitamento' }, { value: 'games', label: 'Jogos' },
  { value: 'appearances', label: 'Presenças' }, { value: 'goalAverage', label: 'Média de gols' },
  { value: 'streak', label: 'Sequências' },
]
const decimal = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const primary = (type: RankingType, item: RankingPublico['itens'][number]) => type === 'goals' ? `${item.gols} gols` : type === 'wins' ? `${item.vitorias} vitórias` : type === 'winRate' ? `${decimal(item.aproveitamento)}%` : type === 'games' ? `${item.partidas} jogos` : type === 'appearances' ? `${item.presencas} presenças` : type === 'goalAverage' ? `${decimal(item.mediaGols)}/jogo` : `${item.maiorSequencia} vitórias seguidas`

export function RankingsPage() {
  const [type, setType] = useState<RankingType>('goals')
  const [period, setPeriod] = useState('all')
  const [seasons, setSeasons] = useState<number[]>([])
  const [rounds, setRounds] = useState<HistoricoRodadaItem[]>([])
  const [ranking, setRanking] = useState<RankingPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const query = new URLSearchParams({ type })
      if (period.startsWith('season:')) query.set('season', period.slice(7))
      else if (period.startsWith('round:')) query.set('roundId', period.slice(6))
      else query.set('scope', 'all')
      const [data, years, history] = await Promise.all([api<RankingPublico>(`/public/rankings?${query}`), api<number[]>('/public/estatisticas/temporadas'), api<HistoricoRodadaItem[]>('/public/historico')])
      setRanking(data); setSeasons(years); setRounds(history)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os rankings') }
    finally { setLoading(false) }
  }, [type, period])
  useEffect(() => { void load() }, [load])
  return <section className="page-shell min-h-[75svh] py-8 sm:py-14">
    <header className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-brita-500">Desempenho real</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">Rankings</h1><p className="mt-3 text-neutral-400">Todos os números são derivados das partidas e gols registrados.</p></header>
    <div className="mt-7 grid gap-3 sm:grid-cols-2">
      <label className="label">Ranking<select value={type} onChange={(event) => setType(event.target.value as RankingType)} className="field mt-2">{types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="label">Período<select value={period} onChange={(event) => setPeriod(event.target.value)} className="field mt-2"><option value="all">Histórico geral</option>{seasons.length > 0 && <optgroup label="Temporadas">{seasons.map((year) => <option key={year} value={`season:${year}`}>{year}</option>)}</optgroup>}{rounds.length > 0 && <optgroup label="Rodadas">{rounds.map((round) => <option key={round.id} value={`round:${round.id}`}>{shortDate(round.data)}</option>)}</optgroup>}</select></label>
    </div>
    {error ? <div className="mt-6"><ErrorState message={error} retry={load}/></div> : loading ? <Loading label="Calculando ranking..."/> : !ranking?.itens.length ? <div className="mt-6"><EmptyState title="Sem ranking neste período" description="Quando houver partidas finalizadas, os resultados aparecerão aqui."/></div> : <ol className="mt-7 space-y-3">{ranking.itens.map((item) => <li key={item.jogador.id}><Link to={`/jogadores/${item.jogador.id}`} className={`surface flex min-h-24 items-center gap-4 p-4 transition hover:border-brita-500/40 sm:p-5 ${item.posicao <= 3 ? 'border-brita-500/20' : ''}`}><span className={`grid size-12 shrink-0 place-items-center rounded-2xl font-black ${item.posicao === 1 ? 'bg-brita-500 text-black' : item.posicao <= 3 ? 'bg-brita-500/15 text-brita-400' : 'bg-white/5 text-neutral-500'}`}>{item.posicao <= 3 ? <Medal size={22}/> : `${item.posicao}º`}</span><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{item.jogador.apelido}</strong><span className="mt-1 block text-sm text-neutral-500">{item.partidas} jogos · {item.gols} gols · {decimal(item.mediaGols)}/jogo</span></span><span className="max-w-28 text-right font-black text-brita-400 sm:max-w-none">{primary(type, item)}</span></Link></li>)}</ol>}
    <aside className="mt-10 grid gap-3 sm:grid-cols-3"><Info icon={Trophy} title="Vitória" text="3 pontos"/><Info icon={Award} title="Empate" text="1 ponto para todos"/><Info icon={CalendarRange} title="Presença" text="1 por rodada"/></aside>
  </section>
}
function Info({ icon: Icon, title, text }: { icon: typeof Trophy; title: string; text: string }) { return <div className="rounded-xl border border-white/10 p-4"><Icon className="text-brita-500" size={20}/><strong className="mt-3 block">{title}</strong><span className="text-sm text-neutral-500">{text}</span></div> }
