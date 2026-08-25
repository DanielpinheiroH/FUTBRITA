import type { ApiErrorResponse } from '@fut-brita/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api'

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) { super(message) }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', navigator.onLine ? 'A API está indisponível. Tente novamente.' : 'Você está sem conexão. Verifique a internet e tente novamente.', 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'NETWORK_ERROR', message: 'Não foi possível concluir a solicitação' })) as ApiErrorResponse
    if (response.status === 401) window.dispatchEvent(new Event('futbrita:unauthorized'))
    throw new ApiError(body.error, body.message, response.status, body.details)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
