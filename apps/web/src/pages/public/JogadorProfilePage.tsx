import { ArrowLeft, BarChart3, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { JogadorPublico } from '@fut-brita/shared'
import { api } from '../../services/api'
import { ErrorState, Loading } from '../../components/ui/States'

export function JogadorProfilePage() {
  const { id } = useParams(); const [player, setPlayer] = useState<JogadorPublico | null>(null); const [error, setError] = useState('')
  useEffect(() => { if (id) api<JogadorPublico>(`/public/jogadores/${id}`).then(setPlayer).catch((e) => setError(e instanceof Error ? e.message : 'Jogador não encontrado')) }, [id])
  return <section className="page-shell min-h-[75svh] py-8 sm:py-14"><Link to="/jogadores" className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-neutral-400 hover:text-white"><ArrowLeft size={19} />Voltar aos jogadores</Link>{error ? <div className="mt-6"><ErrorState message={error} /></div> : !player ? <Loading /> : <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]"><article className="surface p-6 sm:p-8"><span className="grid size-20 place-items-center rounded-3xl bg-brita-500/10 text-brita-500"><UserRound size={38} /></span><p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-brita-500">Jogador Fut Brita</p><h1 className="mt-2 break-words text-4xl font-black tracking-tight">{player.apelido}</h1><p className="mt-2 text-lg text-neutral-400">{player.nome}</p></article><article className="surface flex min-h-64 flex-col items-center justify-center p-6 text-center"><BarChart3 className="text-neutral-700" size={42} /><h2 className="mt-4 text-lg font-bold">Estatísticas em breve</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">O espaço está preparado para receber o histórico esportivo nas próximas etapas.</p></article></div>}</section>
}
