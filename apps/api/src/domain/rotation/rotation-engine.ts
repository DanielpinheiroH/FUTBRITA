export const PLAYERS_PER_TEAM = 6

export interface RotationPlayer {
  id: string
  arrivalOrder: number
}

export interface PermanenceStat {
  count: number
  lastCycle: number | null
}

export interface RotationInput {
  stayingTeam: RotationPlayer[]
  leavingTeam: RotationPlayer[]
  queue: RotationPlayer[]
  permanenceStats: Readonly<Record<string, PermanenceStat>>
  nextCycle: number
}

export interface RotationResult {
  stayingTeam: RotationPlayer[]
  newTeam: RotationPlayer[]
  newQueue: RotationPlayer[]
  promotedPlayers: RotationPlayer[]
  remainingPlayers: RotationPlayer[]
  permanenceStats: Record<string, PermanenceStat>
}

const assertUnique = (groups: RotationPlayer[][]) => {
  const ids = groups.flat().map((player) => player.id)
  if (new Set(ids).size !== ids.length) throw new Error('ESTADO_JOGO_INVALIDO: jogador duplicado')
}

export function formInitialTeams(players: RotationPlayer[]) {
  if (players.length < PLAYERS_PER_TEAM * 2) throw new Error('JOGADORES_INSUFICIENTES')
  const ordered = [...players].sort((a, b) => a.arrivalOrder - b.arrivalOrder)
  assertUnique([ordered])
  return {
    team1: ordered.slice(0, 12).filter((_, index) => index % 2 === 0),
    team2: ordered.slice(0, 12).filter((_, index) => index % 2 === 1),
    queue: ordered.slice(12),
  }
}

export function rotateTeams(input: RotationInput): RotationResult {
  if (input.stayingTeam.length !== PLAYERS_PER_TEAM || input.leavingTeam.length !== PLAYERS_PER_TEAM) {
    throw new Error('TIME_INVALIDO')
  }
  assertUnique([input.stayingTeam, input.leavingTeam, input.queue])
  const promotedPlayers = input.queue.slice(0, PLAYERS_PER_TEAM)
  const missing = PLAYERS_PER_TEAM - promotedPlayers.length
  const stats = { ...input.permanenceStats }
  const rankedLeaving = [...input.leavingTeam].sort((a, b) => {
    const left = stats[a.id] ?? { count: 0, lastCycle: null }
    const right = stats[b.id] ?? { count: 0, lastCycle: null }
    return left.count - right.count || (left.lastCycle ?? -1) - (right.lastCycle ?? -1) || a.arrivalOrder - b.arrivalOrder
  })
  const remainingPlayers = rankedLeaving.slice(0, missing)
  for (const player of remainingPlayers) {
    const current = stats[player.id] ?? { count: 0, lastCycle: null }
    stats[player.id] = { count: current.count + 1, lastCycle: input.nextCycle }
  }
  const remainingIds = new Set(remainingPlayers.map((player) => player.id))
  const queuedLeaving = input.leavingTeam
    .filter((player) => !remainingIds.has(player.id))
    .sort((a, b) => a.arrivalOrder - b.arrivalOrder)
  const newTeam = [...promotedPlayers, ...remainingPlayers]
  const newQueue = [...input.queue.slice(promotedPlayers.length), ...queuedLeaving]
  assertUnique([input.stayingTeam, newTeam, newQueue])
  if (newTeam.length !== PLAYERS_PER_TEAM) throw new Error('TIME_INVALIDO')
  return { stayingTeam: [...input.stayingTeam], newTeam, newQueue, promotedPlayers, remainingPlayers, permanenceStats: stats }
}
