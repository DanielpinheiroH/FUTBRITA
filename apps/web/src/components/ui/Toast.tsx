import { CheckCircle2, XCircle } from 'lucide-react'

export function Toast({ message, kind = 'success' }: { message: string; kind?: 'success' | 'error' }) {
  return <div role="status" className={`fixed bottom-24 left-4 right-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border p-4 shadow-2xl sm:bottom-6 ${kind === 'success' ? 'border-emerald-500/30 bg-emerald-950 text-emerald-100' : 'border-red-500/30 bg-red-950 text-red-100'}`}>{kind === 'success' ? <CheckCircle2 className="shrink-0" /> : <XCircle className="shrink-0" />}<span className="text-sm font-semibold">{message}</span></div>
}
