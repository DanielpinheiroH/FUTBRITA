import type { RankingKind, PlayerMetrics, StatisticMatch } from '../../domain/statistics/statistics-engine.js'
import { buildRanking, calculateAllPlayerStats, calculatePlayerStats } from '../../domain/statistics/statistics-engine.js'
import { AppError } from '../../shared/errors.js'
import type { StatisticsFilter, StatisticsRepository } from './statistics.repository.js'

const filterDto = (filter: StatisticsFilter) => filter.roundId ? { scope: 'round' as const, roundId: filter.roundId } : filter.season ? { scope: 'season' as const, season: filter.season } : { scope: 'all' as const }
export const metricsDto = (item: PlayerMetrics) => ({ jogador: { id: item.player.id, nome: item.player.nome, apelido: item.player.apelido, ativo: item.player.ativo }, partidas: item.games, vitorias: item.wins, empates: item.draws, derrotas: item.losses, gols: item.goals, mediaGols: item.goalAverage, pontos: item.points, aproveitamento: item.winRate, presencas: item.appearances, sequenciaAtual: item.currentStreak, maiorSequencia: item.bestStreak })

export class StatisticsService {
  constructor(private readonly repository: StatisticsRepository) {}

  async player(playerId: string, filter: StatisticsFilter) {
    const [dataset, seasons] = await Promise.all([this.repository.dataset(filter), this.repository.availableSeasons(playerId)])
    const player = dataset.players.find((item) => item.id === playerId)
    if (!player) throw new AppError(404, 'NOT_FOUND', 'Jogador não encontrado')
    const calculated = calculatePlayerStats(player, dataset.matches, dataset.appearances)
    return {
      ...metricsDto(calculated.metrics), filtro: filterDto(filter), temporadas: seasons,
      historicoRecente: calculated.history.map((round) => ({ rodadaId: round.roundId, data: round.date, partidas: round.games, vitorias: round.wins, empates: round.draws, derrotas: round.losses, gols: round.goals, jogos: round.matches.map((match) => ({ partidaId: match.matchId, numero: match.number, lado: match.side, resultado: match.result, desempenho: match.outcome, placarTime1: match.score1, placarTime2: match.score2, gols: match.goals })) })),
    }
  }

  async ranking(type: RankingKind, filter: StatisticsFilter, minGames: number) {
    const dataset = await this.repository.dataset(filter)
    const ranking = buildRanking(calculateAllPlayerStats(dataset.players, dataset.matches, dataset.appearances), type, minGames)
    return { tipo: type, filtro: filterDto(filter), minGames, itens: ranking.map((item, index) => ({ posicao: index + 1, ...metricsDto(item) })) }
  }

  async roundSummary(roundId: string, requireClosed = false) {
    const [info, dataset] = await Promise.all([this.repository.roundInfo(roundId), this.repository.dataset({ roundId })])
    if (!info || (requireClosed && info.status !== 'ENCERRADA')) throw new AppError(404, 'NOT_FOUND', 'Rodada encerrada não encontrada')
    const metrics = calculateAllPlayerStats(dataset.players, dataset.matches, dataset.appearances)
    const goals = buildRanking(metrics, 'goals', 1); const wins = buildRanking(metrics, 'wins', 1); const games = buildRanking(metrics, 'games', 1)
    const players = new Map(dataset.players.map((player) => [player.id, player]))
    return {
      id: info.id, data: info.date,
      participantes: info.participations.filter((item) => item.present).length,
      jogadoresLinha: info.participations.filter((item) => item.present && item.type === 'LINHA').length,
      goleiros: info.participations.filter((item) => item.present && item.type === 'GOLEIRO').length,
      partidas: dataset.matches.length, gols: dataset.matches.reduce((total, match) => total + match.goals.length, 0),
      jogos: dataset.matches.sort((a, b) => a.number - b.number).map((match) => this.matchDto(match, players)),
      destaques: { artilheiro: goals[0] ? metricsDto(goals[0]) : null, maisVitorias: wins[0] ? metricsDto(wins[0]) : null, maisJogos: games[0] ? metricsDto(games[0]) : null },
      ranking: goals.map(metricsDto),
    }
  }

  async history() { return (await this.repository.history()).map((round) => ({ id: round.id, data: round.date, participantes: round.participants, jogadoresLinha: round.linePlayers, goleiros: round.goalkeepers, partidas: round.matches, gols: round.goals })) }
  async seasons() { return this.repository.availableSeasons() }

  async publicSummary() {
    const [current, history, seasons] = await Promise.all([this.repository.currentRound(), this.repository.history(), this.repository.availableSeasons()])
    const season = seasons[0] ?? new Date().getUTCFullYear(); const dataset = await this.repository.dataset({ season }); const metrics = calculateAllPlayerStats(dataset.players, dataset.matches, dataset.appearances)
    const goals = buildRanking(metrics, 'goals', 1)[0] ?? null; const wins = buildRanking(metrics, 'wins', 1)[0] ?? null; const rate = buildRanking(metrics, 'winRate', 1)[0] ?? null
    return { rodadaAtual: current, ultimaRodada: history[0] ? { id: history[0].id, data: history[0].date, partidas: history[0].matches, gols: history[0].goals } : null, destaquesTemporada: { temporada: season, artilheiro: goals ? metricsDto(goals) : null, maisVitorias: wins ? metricsDto(wins) : null, melhorAproveitamento: rate ? metricsDto(rate) : null } }
  }

  private matchDto(match: StatisticMatch, players: Map<string, { id: string; nome: string; apelido: string }>) {
    const player = (playerId: string, side: 'TIME_1' | 'TIME_2') => { const item = players.get(playerId)!; return { participacaoId: playerId, nome: item.nome, apelido: item.apelido, lado: side } }
    return { id: match.id, numero: match.number, placarTime1: match.score1, placarTime2: match.score2, resultado: match.result, time1: match.lineups.filter((item) => item.side === 'TIME_1').map((item) => player(item.playerId, item.side)), time2: match.lineups.filter((item) => item.side === 'TIME_2').map((item) => player(item.playerId, item.side)), gols: match.goals.map((goal, index) => { const item = players.get(goal.playerId)!; return { id: goal.id ?? `${match.id}-${index}`, participacaoId: goal.playerId, nome: item.nome, apelido: item.apelido, lado: goal.side, ordem: goal.order ?? index + 1, createdAt: goal.createdAt ?? '', updatedAt: goal.createdAt ?? '' } }) }
  }
}
