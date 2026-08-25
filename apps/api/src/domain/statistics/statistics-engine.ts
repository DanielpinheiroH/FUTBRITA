export type StatisticSide = 'TIME_1' | 'TIME_2'
export type StatisticResult = StatisticSide | 'EMPATE'
export type RankingKind = 'goals' | 'wins' | 'winRate' | 'games' | 'appearances' | 'goalAverage' | 'streak'

export interface StatisticPlayer { id: string; nome: string; apelido: string; fotoUrl?: string | null; ativo: boolean }
export interface StatisticAppearance { playerId: string; roundId: string; date: string }
export interface StatisticMatch {
  id: string; roundId: string; date: string; number: number; result: StatisticResult; winner: StatisticSide | null
  score1: number; score2: number; lineups: Array<{ playerId: string; side: StatisticSide }>; goals: Array<{ id?: string; playerId: string; side: StatisticSide; order?: number; createdAt?: string }>
}
export interface PlayerMetrics {
  player: StatisticPlayer; games: number; wins: number; draws: number; losses: number; goals: number; goalAverage: number
  points: number; winRate: number; appearances: number; currentStreak: number; bestStreak: number
}
export interface PlayerRoundHistory {
  roundId: string; date: string; games: number; wins: number; draws: number; losses: number; goals: number
  matches: Array<{ matchId: string; number: number; side: StatisticSide; result: StatisticResult; outcome: 'VITORIA' | 'EMPATE' | 'DERROTA'; score1: number; score2: number; goals: number }>
}

const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const byTime = (a: StatisticMatch, b: StatisticMatch) => a.date.localeCompare(b.date) || a.number - b.number || a.id.localeCompare(b.id)
const nameOrder = (a: PlayerMetrics, b: PlayerMetrics) => a.player.apelido.localeCompare(b.player.apelido, 'pt-BR', { sensitivity: 'base' }) || a.player.nome.localeCompare(b.player.nome, 'pt-BR', { sensitivity: 'base' })

export function calculatePlayerStats(player: StatisticPlayer, matches: StatisticMatch[], appearances: StatisticAppearance[]): { metrics: PlayerMetrics; history: PlayerRoundHistory[] } {
  const played = matches.filter((match) => match.lineups.some((lineup) => lineup.playerId === player.id)).sort(byTime)
  let wins = 0; let draws = 0; let losses = 0; let currentStreak = 0; let bestStreak = 0
  const history = new Map<string, PlayerRoundHistory>()
  for (const match of played) {
    const lineup = match.lineups.find((item) => item.playerId === player.id)!
    const outcome = match.result === 'EMPATE' ? 'EMPATE' : match.winner === lineup.side ? 'VITORIA' : 'DERROTA'
    if (outcome === 'VITORIA') { wins++; currentStreak++; bestStreak = Math.max(bestStreak, currentStreak) } else { currentStreak = 0; if (outcome === 'EMPATE') draws++; else losses++ }
    const goals = match.goals.filter((goal) => goal.playerId === player.id).length
    const round = history.get(match.roundId) ?? { roundId: match.roundId, date: match.date, games: 0, wins: 0, draws: 0, losses: 0, goals: 0, matches: [] }
    round.games++; round.goals += goals
    if (outcome === 'VITORIA') round.wins++; else if (outcome === 'EMPATE') round.draws++; else round.losses++
    round.matches.push({ matchId: match.id, number: match.number, side: lineup.side, result: match.result, outcome, score1: match.score1, score2: match.score2, goals })
    history.set(match.roundId, round)
  }
  const goals = played.reduce((total, match) => total + match.goals.filter((goal) => goal.playerId === player.id).length, 0)
  const games = played.length; const points = wins * 3 + draws
  const uniqueAppearances = new Set(appearances.filter((item) => item.playerId === player.id).map((item) => item.roundId)).size
  return {
    metrics: { player, games, wins, draws, losses, goals, goalAverage: games ? rounded(goals / games) : 0, points, winRate: games ? rounded(points / (games * 3) * 100) : 0, appearances: uniqueAppearances, currentStreak, bestStreak },
    history: [...history.values()].sort((a, b) => b.date.localeCompare(a.date) || b.roundId.localeCompare(a.roundId)),
  }
}

export function calculateAllPlayerStats(players: StatisticPlayer[], matches: StatisticMatch[], appearances: StatisticAppearance[]) {
  return players.map((player) => calculatePlayerStats(player, matches, appearances).metrics)
}

export function buildRanking(metrics: PlayerMetrics[], type: RankingKind, minGames = 1): PlayerMetrics[] {
  const eligible = metrics.filter((item) => type === 'appearances' ? item.appearances > 0 : item.games >= minGames)
  return [...eligible].sort((a, b) => {
    if (type === 'goals') return b.goals - a.goals || b.goalAverage - a.goalAverage || b.wins - a.wins || nameOrder(a, b)
    if (type === 'wins') return b.wins - a.wins || b.winRate - a.winRate || b.games - a.games || nameOrder(a, b)
    if (type === 'winRate') return b.winRate - a.winRate || b.games - a.games || b.wins - a.wins || nameOrder(a, b)
    if (type === 'games') return b.games - a.games || b.wins - a.wins || nameOrder(a, b)
    if (type === 'appearances') return b.appearances - a.appearances || b.games - a.games || nameOrder(a, b)
    if (type === 'goalAverage') return b.goalAverage - a.goalAverage || b.goals - a.goals || b.games - a.games || nameOrder(a, b)
    return b.bestStreak - a.bestStreak || b.wins - a.wins || b.winRate - a.winRate || nameOrder(a, b)
  })
}
