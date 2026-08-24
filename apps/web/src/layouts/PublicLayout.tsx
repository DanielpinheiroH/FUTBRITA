import { Menu, Shield, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }: { isActive: boolean }) => `flex min-h-12 items-center rounded-xl px-4 font-semibold transition ${isActive ? 'bg-brita-500/15 text-brita-400' : 'text-neutral-300 hover:bg-white/5'}`
  return <div className="noise min-h-svh overflow-x-hidden bg-neutral-950">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/90 backdrop-blur-xl"><div className="page-shell flex h-16 items-center justify-between"><Link to="/" className="flex min-h-12 items-center gap-3 font-black tracking-tight"><span className="grid size-9 place-items-center rounded-lg bg-brita-500 text-lg italic text-black">FB</span><span>FUT BRITA</span></Link><nav className="hidden items-center gap-1 sm:flex"><NavLink to="/" className={linkClass}>Início</NavLink><NavLink to="/jogadores" className={linkClass}>Jogadores</NavLink><Link to="/admin" className="ml-2 flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-neutral-300 hover:bg-white/5"><Shield size={18} />Admin</Link></nav><button onClick={() => setOpen(!open)} className="grid size-12 place-items-center rounded-xl text-neutral-200 sm:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>{open ? <X /> : <Menu />}</button></div>
      {open && <nav className="page-shell space-y-1 border-t border-white/5 py-3 sm:hidden"><NavLink onClick={() => setOpen(false)} to="/" className={linkClass}>Início</NavLink><NavLink onClick={() => setOpen(false)} to="/jogadores" className={linkClass}><Users className="mr-2" size={18} />Jogadores</NavLink><Link onClick={() => setOpen(false)} to="/admin" className="flex min-h-12 items-center rounded-xl px-4 font-semibold text-neutral-300"><Shield className="mr-2" size={18} />Área administrativa</Link></nav>}
    </header><main><Outlet /></main><footer className="border-t border-white/10 py-8"><div className="page-shell text-center text-sm text-neutral-500">FUT BRITA · Toda quarta, a resenha entra em campo.</div></footer>
  </div>
}
