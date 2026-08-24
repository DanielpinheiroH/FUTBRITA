export type TeamSide = 'TIME_1' | 'TIME_2'
export type MatchResult = TeamSide | 'EMPATE'

export interface MatchResolution {
  result: MatchResult
  winner: TeamSide | null
  staying: TeamSide
  leaving: TeamSide
}

export const oppositeSide = (side: TeamSide): TeamSide => side === 'TIME_1' ? 'TIME_2' : 'TIME_1'

export function resolveMatch(score1: number, score2: number, permanent: TeamSide, entrant: TeamSide): MatchResolution {
  if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0 || permanent === entrant) throw new Error('RESULTADO_INVALIDO')
  if (score1 === score2) return { result: 'EMPATE', winner: null, staying: permanent, leaving: entrant }
  const winner: TeamSide = score1 > score2 ? 'TIME_1' : 'TIME_2'
  return { result: winner, winner, staying: winner, leaving: oppositeSide(winner) }
}
