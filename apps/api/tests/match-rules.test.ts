import { describe, expect, it } from 'vitest'
import { oppositeSide, resolveMatch, type TeamSide } from '../src/domain/matches/match-rules.js'

describe('regras puras de resultado da partida', () => {
  it.each([[1, 0], [5, 2]])('%i x %i mantém o Time 1', (one, two) => expect(resolveMatch(one, two, 'TIME_1', 'TIME_2')).toEqual({ result: 'TIME_1', winner: 'TIME_1', staying: 'TIME_1', leaving: 'TIME_2' }))
  it.each([[0, 1], [2, 5]])('%i x %i mantém o Time 2', (one, two) => expect(resolveMatch(one, two, 'TIME_1', 'TIME_2')).toEqual({ result: 'TIME_2', winner: 'TIME_2', staying: 'TIME_2', leaving: 'TIME_1' }))
  it.each([[0, 0], [1, 1], [2, 2], [5, 5]])('%i x %i mantém o permanente e retira o entrante', (one, two) => expect(resolveMatch(one, two, 'TIME_2', 'TIME_1')).toEqual({ result: 'EMPATE', winner: null, staying: 'TIME_2', leaving: 'TIME_1' }))
  it('dá vantagem inicial ao Time 1', () => expect(resolveMatch(2, 2, 'TIME_1', 'TIME_2').staying).toBe('TIME_1'))
  it('transfere a vantagem ao vencedor e a conserva em empates sucessivos', () => {
    let permanent: TeamSide = 'TIME_1'
    const first = resolveMatch(0, 1, permanent, oppositeSide(permanent)); permanent = first.staying; expect(permanent).toBe('TIME_2')
    for (const score of [0, 1, 2, 5]) { const draw = resolveMatch(score, score, permanent, oppositeSide(permanent)); expect(draw.staying).toBe('TIME_2'); permanent = draw.staying }
  })
  it('cobre sequência vitória, dois empates, vitória do entrante e empate', () => {
    let permanent: TeamSide = 'TIME_1'
    for (const [score1, score2, expected] of [[1, 0, 'TIME_1'], [1, 1, 'TIME_1'], [2, 2, 'TIME_1'], [0, 1, 'TIME_2'], [3, 3, 'TIME_2']] as const) {
      const result = resolveMatch(score1, score2, permanent, oppositeSide(permanent)); expect(result.staying).toBe(expected); permanent = result.staying
    }
  })
})
