import { ArrowLeft, CalendarPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { RodadaAdmin } from '@fut-brita/shared'
import { api } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

function nextWednesday() {
  const date = new Date(); const diff = (3 - date.getDay() + 7) % 7 || 7; date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function NovaRodadaPage() {
  const navigate = useNavigate(); const [data, setData] = useState(nextWednesday); const [horario, setHorario] = useState('20:00'); const [valor, setValor] = useState('11.00'); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { const round = await api<RodadaAdmin>('/admin/rodadas', { method: 'POST', body: JSON.stringify({ data, horario, valorJogadorLinha: Number(valor) }) }); navigate(`/admin/rodadas/${round.id}`, { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar a rodada') } finally { setSaving(false) } }
  return <div className="page-shell py-7 sm:py-10"><Link to="/admin/rodadas" className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-neutral-400"><ArrowLeft size={19} />Voltar às rodadas</Link><section className="surface mt-5 max-w-xl p-5 sm:p-8"><span className="grid size-14 place-items-center rounded-2xl bg-brita-500/10 text-brita-500"><CalendarPlus /></span><h1 className="mt-6 text-3xl font-black">Nova rodada</h1><p className="mt-2 text-sm leading-relaxed text-neutral-500">A próxima quarta já vem sugerida. Ajuste quando houver exceção.</p>{error && <div role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}<form onSubmit={submit} className="mt-7 space-y-5"><Input label="Data" type="date" name="data" value={data} onChange={(e) => setData(e.target.value)} required /><Input label="Horário" type="time" name="horario" value={horario} onChange={(e) => setHorario(e.target.value)} required /><Input label="Valor por jogador de linha" type="number" inputMode="decimal" step="0.01" min="0.01" name="valor" value={valor} onChange={(e) => setValor(e.target.value)} required /><Button type="submit" className="w-full" disabled={saving}>{saving ? 'Criando...' : 'Criar rodada'}</Button></form></section></div>
}
