import { describe, expect, it } from 'vitest'
import { formInitialTeams, PLAYERS_PER_TEAM, rotateTeams, type PermanenceStat, type RotationPlayer } from '../src/domain/rotation/rotation-engine.js'

const players = (count: number, start = 1): RotationPlayer[] => Array.from({ length: count }, (_, index) => ({ id: `p${start + index}`, arrivalOrder: start + index }))
const assertState = (team1: RotationPlayer[], team2: RotationPlayer[], queue: RotationPlayer[], total: number) => {
  expect(team1).toHaveLength(PLAYERS_PER_TEAM); expect(team2).toHaveLength(PLAYERS_PER_TEAM)
  const ids = [...team1, ...team2, ...queue].map((player) => player.id)
  expect(ids).toHaveLength(total); expect(new Set(ids)).toHaveProperty('size', total)
}

describe('motor puro de rodízio', () => {
  it.each([
    [12, 0, 6], [13, 1, 5], [14, 2, 4], [15, 3, 3], [16, 4, 2], [17, 5, 1],
    [18, 6, 0], [19, 7, 0], [20, 8, 0], [24, 12, 0], [30, 18, 0],
  ])('calcula %i jogadores: fila %i e permanências %i', (total, queueSize, remaining) => {
    const initial = formInitialTeams(players(total))
    expect(initial.team1.map((p) => p.arrivalOrder)).toEqual([1, 3, 5, 7, 9, 11])
    expect(initial.team2.map((p) => p.arrivalOrder)).toEqual([2, 4, 6, 8, 10, 12])
    expect(initial.queue).toHaveLength(queueSize)
    const result = rotateTeams({ stayingTeam: initial.team1, leavingTeam: initial.team2, queue: initial.queue, permanenceStats: {}, nextCycle: 2 })
    expect(result.remainingPlayers).toHaveLength(remaining)
    assertState(result.stayingTeam, result.newTeam, result.newQueue, total)
  })

  it('usa quantidade, maior tempo sem permanência e chegada como desempates', () => {
    const initial = formInitialTeams(players(16)); const leaving = initial.team2
    const stats: Record<string, PermanenceStat> = {
      [leaving[0].id]: { count: 1, lastCycle: 2 }, [leaving[1].id]: { count: 0, lastCycle: 8 },
      [leaving[2].id]: { count: 0, lastCycle: 3 }, [leaving[3].id]: { count: 0, lastCycle: 3 },
    }
    const result = rotateTeams({ stayingTeam: initial.team1, leavingTeam: leaving, queue: initial.queue, permanenceStats: stats, nextCycle: 10 })
    expect(result.remainingPlayers.map((p) => p.arrivalOrder)).toEqual([10, 12])
  })

  it('preserva invariantes em 10 ciclos com 16 jogadores e distribui permanências', () => {
    const initial = formInitialTeams(players(16)); let team1 = initial.team1; let team2 = initial.team2; let queue = initial.queue; let stats: Record<string, PermanenceStat> = {}
    for (let cycle = 2; cycle <= 11; cycle++) {
      const leavingTime1 = cycle % 2 === 0
      const result = rotateTeams({ stayingTeam: leavingTime1 ? team2 : team1, leavingTeam: leavingTime1 ? team1 : team2, queue, permanenceStats: stats, nextCycle: cycle })
      if (leavingTime1) { team2 = result.stayingTeam; team1 = result.newTeam } else { team1 = result.stayingTeam; team2 = result.newTeam }
      queue = result.newQueue; stats = result.permanenceStats; assertState(team1, team2, queue, 16)
    }
    const counts = Object.values(stats).map((stat) => stat.count)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('aceita chegada tardia no fim da fila sem alterar times', () => {
    const initial = formInitialTeams(players(16)); const late = players(1, 17)[0]
    const queue = [...initial.queue, late]
    expect(queue.at(-1)?.id).toBe('p17'); assertState(initial.team1, initial.team2, queue, 17)
  })
})
