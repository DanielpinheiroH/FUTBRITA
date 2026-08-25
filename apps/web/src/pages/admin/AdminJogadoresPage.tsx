import { Camera, Check, ImagePlus, Pencil, Plus, Search, Trash2, UserX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { JogadorAdmin } from '@fut-brita/shared'
import { api } from '../../services/api'
import { preparePlayerPhoto } from '../../utils/player-photo'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { Toast } from '../../components/ui/Toast'

interface FormState { nome: string; apelido: string; telefone: string; fotoUrl: string | null }
type FormErrors = Partial<Record<keyof FormState, string>>
const blank: FormState = { nome: '', apelido: '', telefone: '', fotoUrl: null }

function phoneMask(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function AdminJogadoresPage() {
  const [players, setPlayers] = useState<JogadorAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JogadorAdmin | null>(null)
  const [form, setForm] = useState<FormState>(blank)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [confirmPlayer, setConfirmPlayer] = useState<JogadorAdmin | null>(null)
  const [toast, setToast] = useState<{ message: string; kind?: 'success' | 'error' } | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setPlayers(await api(`/admin/jogadores${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os jogadores') }
    finally { setLoading(false) }
  }, [query])

  useEffect(() => { const timeout = window.setTimeout(() => { void load() }, 250); return () => clearTimeout(timeout) }, [load])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 3500); return () => clearTimeout(timeout) }, [toast])

  const openNew = () => { setEditing(null); setForm(blank); setFormErrors({}); setFormOpen(true) }
  const openEdit = (player: JogadorAdmin) => {
    setEditing(player)
    setForm({ nome: player.nome, apelido: player.apelido, telefone: phoneMask(player.telefone), fotoUrl: player.fotoUrl })
    setFormErrors({}); setFormOpen(true)
  }
  const validate = () => {
    const errors: FormErrors = {}
    if (!form.nome.trim()) errors.nome = 'Nome é obrigatório'
    if (!form.apelido.trim()) errors.apelido = 'Apelido é obrigatório'
    if (!/^(?:55)?[1-9]{2}9?\d{8}$/.test(form.telefone.replace(/\D/g, ''))) errors.telefone = 'Informe um telefone brasileiro válido'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }
  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true); setFormErrors((current) => ({ ...current, fotoUrl: undefined }))
    try {
      const fotoUrl = await preparePlayerPhoto(file)
      setForm((current) => ({ ...current, fotoUrl }))
    }
    catch (e) { setFormErrors((current) => ({ ...current, fotoUrl: e instanceof Error ? e.message : 'Não foi possível preparar a foto.' })) }
    finally { setPhotoBusy(false) }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate() || photoBusy) return
    setSaving(true)
    try {
      await api(editing ? `/admin/jogadores/${editing.id}` : '/admin/jogadores', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(form) })
      setFormOpen(false)
      setToast({ message: editing ? 'Jogador atualizado com sucesso.' : 'Jogador cadastrado com sucesso.' })
      await load()
    } catch (e) { setToast({ message: e instanceof Error ? e.message : 'Não foi possível salvar', kind: 'error' }) }
    finally { setSaving(false) }
  }
  const toggle = async (player: JogadorAdmin) => {
    setConfirmPlayer(null)
    try {
      await api(`/admin/jogadores/${player.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !player.ativo }) })
      setToast({ message: player.ativo ? 'Jogador inativado.' : 'Jogador ativado.' }); await load()
    } catch (e) { setToast({ message: e instanceof Error ? e.message : 'Não foi possível alterar o status', kind: 'error' }) }
  }

  return <div className="page-shell py-7 sm:py-10">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold text-brita-500">CADASTROS</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Jogadores</h1><p className="mt-2 text-neutral-500">Gerencie a turma do Fut Brita.</p></div>
      <Button onClick={openNew} className="w-full sm:w-auto"><Plus size={20} />Novo jogador</Button>
    </div>
    <div className="relative mt-7 max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} /><label htmlFor="admin-search" className="sr-only">Pesquisar jogadores</label><input id="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} className="field pl-12" placeholder="Pesquisar nome ou apelido" /></div>
    <div className="mt-6">{loading ? <Loading /> : error ? <ErrorState message={error} retry={load} /> : players.length === 0 ? <EmptyState title={query ? 'Nenhum resultado' : 'Nenhum jogador cadastrado'} description={query ? 'Revise a busca e tente novamente.' : 'Cadastre o primeiro jogador para começar.'} /> : <div className="grid gap-3 lg:grid-cols-2">{players.map((player) => <article key={player.id} className={`surface p-4 sm:p-5 ${!player.ativo ? 'opacity-65' : ''}`}><div className="flex min-w-0 items-start gap-3"><PlayerAvatar fotoUrl={player.fotoUrl} nome={player.nome} className="size-12 rounded-xl" iconSize={22} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-extrabold">{player.apelido}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${player.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-700 text-neutral-400'}`}>{player.ativo ? 'Ativo' : 'Inativo'}</span></div><p className="mt-1 truncate text-sm text-neutral-400">{player.nome}</p><p className="mt-1 text-sm text-neutral-600">{phoneMask(player.telefone)}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-4"><Button variant="secondary" onClick={() => openEdit(player)}><Pencil size={17} />Editar</Button><Button variant={player.ativo ? 'danger' : 'secondary'} onClick={() => player.ativo ? setConfirmPlayer(player) : void toggle(player)}>{player.ativo ? <UserX size={17} /> : <Check size={17} />}{player.ativo ? 'Inativar' : 'Ativar'}</Button></div></article>)}</div>}</div>

    {formOpen && <Modal title={editing ? 'Editar jogador' : 'Novo jogador'} onClose={() => setFormOpen(false)}><form onSubmit={save} className="space-y-5">
      <div><span className="label block">Foto do jogador</span><div className="mt-2 flex items-center gap-4"><PlayerAvatar fotoUrl={form.fotoUrl} nome={form.nome || form.apelido || 'jogador'} className="size-24 rounded-2xl" iconSize={36} eager /><div className="min-w-0 flex-1"><p className="text-sm text-neutral-400">Tire uma foto agora ou escolha uma imagem do celular.</p>{photoBusy && <p className="mt-1 text-sm font-bold text-brita-400">Preparando foto...</p>}</div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="secondary" disabled={photoBusy} onClick={() => cameraInput.current?.click()}><Camera size={18} />Tirar foto</Button><Button type="button" variant="secondary" disabled={photoBusy} onClick={() => fileInput.current?.click()}><ImagePlus size={18} />Arquivo</Button></div>
        <input ref={cameraInput} type="file" accept="image/*" capture="user" onChange={selectPhoto} className="sr-only" aria-label="Tirar foto do jogador" />
        <input ref={fileInput} type="file" accept="image/*" onChange={selectPhoto} className="sr-only" aria-label="Escolher foto do jogador" />
        {form.fotoUrl && <Button type="button" variant="ghost" className="mt-2 w-full text-red-300" onClick={() => setForm((current) => ({ ...current, fotoUrl: null }))}><Trash2 size={17} />Remover foto</Button>}
        {formErrors.fotoUrl && <p className="mt-2 text-sm text-red-400" role="alert">{formErrors.fotoUrl}</p>}
      </div>
      <Input label="Nome" name="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} error={formErrors.nome} placeholder="Nome completo" autoComplete="name" />
      <Input label="Apelido" name="apelido" value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} error={formErrors.apelido} placeholder="Como é conhecido" />
      <Input label="Telefone" name="telefone" type="tel" inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: phoneMask(e.target.value) })} error={formErrors.telefone} placeholder="(61) 99999-9999" autoComplete="tel" />
      <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving || photoBusy}>{saving ? 'Salvando...' : 'Salvar jogador'}</Button></div>
    </form></Modal>}
    {confirmPlayer && <Modal title="Inativar jogador?" onClose={() => setConfirmPlayer(null)}><p className="leading-relaxed text-neutral-400"><strong className="text-white">{confirmPlayer.apelido}</strong> deixará de aparecer na área pública. O cadastro será mantido e poderá ser reativado.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => setConfirmPlayer(null)}><X size={18} />Cancelar</Button><Button variant="danger" onClick={() => void toggle(confirmPlayer)}><UserX size={18} />Confirmar inativação</Button></div></Modal>}
    {toast && <Toast {...toast} />}
  </div>
}
