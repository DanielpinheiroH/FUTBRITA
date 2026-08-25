import { UserRound } from 'lucide-react'

interface PlayerAvatarProps {
  fotoUrl?: string | null
  nome: string
  className?: string
  iconSize?: number
  eager?: boolean
}

export function PlayerAvatar({ fotoUrl, nome, className = 'size-14 rounded-2xl', iconSize = 24, eager = false }: PlayerAvatarProps) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden bg-brita-500/10 text-brita-500 ${className}`}>
    {fotoUrl
      ? <img src={fotoUrl} alt={`Foto de ${nome}`} className="size-full object-cover" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      : <UserRound size={iconSize} aria-hidden="true" />}
  </span>
}
