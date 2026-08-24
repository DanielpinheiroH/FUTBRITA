import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
export function Input({ label, error, id, className = '', ...props }: Props) {
  const inputId = id ?? props.name
  return <div><label className="label" htmlFor={inputId}>{label}</label><input id={inputId} className={`field ${error ? 'border-red-500' : ''} ${className}`} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />{error && <p id={`${inputId}-error`} className="mt-2 text-sm text-red-400">{error}</p>}</div>
}
