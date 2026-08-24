import type { StatusRodada } from '@fut-brita/shared'

export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const dateBr = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
export const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
export const statusLabel: Record<StatusRodada, string> = { PLANEJADA: 'Planejada', PREPARACAO: 'Preparação', EM_ANDAMENTO: 'Em andamento', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada' }
export const statusClass: Record<StatusRodada, string> = { PLANEJADA: 'bg-sky-500/10 text-sky-300', PREPARACAO: 'bg-brita-500/15 text-brita-400', EM_ANDAMENTO: 'bg-emerald-500/15 text-emerald-300', ENCERRADA: 'bg-neutral-700 text-neutral-300', CANCELADA: 'bg-red-500/10 text-red-300' }
