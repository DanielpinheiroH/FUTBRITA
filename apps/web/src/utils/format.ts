import type { StatusRodada } from '@fut-brita/shared'

export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const DATE_FALLBACK = 'Data não informada'

const parseDate = (value?: string | null) => {
  const datePart = value?.slice(0, 10)

  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null

  const date = new Date(`${datePart}T12:00:00Z`)

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) return null

  return date
}

export const dateBr = (value?: string | null) => {
  const date = parseDate(value)

  return date
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(date)
    : DATE_FALLBACK
}

export const shortDate = (value?: string | null) => {
  const date = parseDate(value)

  return date
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
    : DATE_FALLBACK
}
export const statusLabel: Record<StatusRodada, string> = { PLANEJADA: 'Planejada', PREPARACAO: 'Preparação', EM_ANDAMENTO: 'Em andamento', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada' }
export const statusClass: Record<StatusRodada, string> = { PLANEJADA: 'bg-sky-500/10 text-sky-300', PREPARACAO: 'bg-brita-500/15 text-brita-400', EM_ANDAMENTO: 'bg-emerald-500/15 text-emerald-300', ENCERRADA: 'bg-neutral-700 text-neutral-300', CANCELADA: 'bg-red-500/10 text-red-300' }
