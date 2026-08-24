import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; children: ReactNode }
const variants = {
  primary: 'bg-brita-500 text-black hover:bg-brita-400 shadow-glow',
  secondary: 'border border-white/15 bg-white/5 text-white hover:bg-white/10',
  danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
  ghost: 'text-neutral-300 hover:bg-white/5 hover:text-white',
}

export function Button({ variant = 'primary', className = '', children, ...props }: Props) {
  return <button className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>
}
