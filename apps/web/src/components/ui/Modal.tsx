import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
      <header className="mb-5 flex items-center justify-between gap-3"><h2 id="modal-title" className="text-xl font-extrabold">{title}</h2><button onClick={onClose} aria-label="Fechar" className="flex size-12 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-white/5"><X /></button></header>{children}
    </section>
  </div>
}
