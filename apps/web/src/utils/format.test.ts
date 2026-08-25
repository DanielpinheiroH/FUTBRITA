import { describe, expect, it } from 'vitest'
import { dateBr, shortDate } from './format'

describe('formatadores de data', () => {
  it('formata datas simples sem alterar o dia', () => {
    expect(dateBr('2026-08-25')).not.toBe('Data não informada')
    expect(shortDate('2026-08-25')).toContain('25')
    expect(shortDate('2026-08-25')).toContain('2026')
  })

  it('aceita timestamps ISO retornados pelo backend', () => {
    expect(shortDate('2026-08-25T00:00:00.000Z')).toBe(shortDate('2026-08-25'))
  })

  it('não interrompe a aplicação quando a data é ausente ou inválida', () => {
    expect(dateBr(null)).toBe('Data não informada')
    expect(shortDate('data-invalida')).toBe('Data não informada')
    expect(shortDate('2026-02-31')).toBe('Data não informada')
  })
})
