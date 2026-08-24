import { readFile, unlink, writeFile } from 'node:fs/promises'
import 'dotenv/config'
import { LadoEquipe, PrismaClient, ResultadoPartida, StatusPartida, StatusRodada, TipoParticipacao } from '@prisma/client'

const prisma = new PrismaClient()
const stateFile = new URL('../.tmp-etapa4-visual.json', import.meta.url)
const action = process.argv[2]

if (action === 'setup') {
  const suffix = Date.now().toString()
  const admin = await prisma.admin.findUniqueOrThrow({ where: { email: process.env.ADMIN_INITIAL_EMAIL } })
  const result = await prisma.$transaction(async (tx) => {
    const round = await tx.rodada.create({ data: { data: new Date('2099-11-04T00:00:00Z'), horario: new Date('1970-01-01T20:00:00Z'), status: StatusRodada.EM_ANDAMENTO, valorJogadorLinha: 11, createdBy: admin.id, startedAt: new Date() } })
    const participations = []
    const playerIds = []
    for (let index = 1; index <= 16; index++) {
      const jogador = await tx.jogador.create({ data: { nome: `Visual Etapa 4 Jogador ${index} ${suffix}`, apelido: `Brita ${index}`, telefone: `649${String(10000000 + index)}` } })
      playerIds.push(jogador.id)
      const participation = await tx.participacaoRodada.create({ data: { rodadaId: round.id, jogadorId: jogador.id, tipo: TipoParticipacao.LINHA, confirmado: true, presente: true, ordemChegada: index, chegouEm: new Date() } })
      await tx.pagamento.create({ data: { participacaoId: participation.id, valor: 11, updatedBy: admin.id } })
      participations.push(participation.id)
    }
    await tx.estadoRodadaJogo.create({ data: { rodadaId: round.id, cicloAtual: 2 } })
    const cycle1 = await tx.cicloRodada.create({ data: { rodadaId: round.id, numero: 1 } })
    const cycle2 = await tx.cicloRodada.create({ data: { rodadaId: round.id, numero: 2, timeSaiu: LadoEquipe.TIME_2 } })
    const lineup = participations.slice(0, 12).map((participacaoId, index) => ({ participacaoId, lado: index % 2 === 0 ? LadoEquipe.TIME_1 : LadoEquipe.TIME_2 }))
    await tx.escalacaoCiclo.createMany({ data: lineup.flatMap((item) => [{ cicloId: cycle1.id, ...item }, { cicloId: cycle2.id, ...item }]) })
    await tx.filaCiclo.createMany({ data: participations.slice(12).flatMap((participacaoId, index) => [{ cicloId: cycle1.id, participacaoId, posicao: index + 1 }, { cicloId: cycle2.id, participacaoId, posicao: index + 1 }]) })
    await tx.permanenciaRodada.createMany({ data: participations.map((participacaoId) => ({ rodadaId: round.id, participacaoId })) })
    const oldMatch = await tx.partida.create({ data: { rodadaId: round.id, cicloId: cycle1.id, numero: 1, status: StatusPartida.FINALIZADA, timePermanente: LadoEquipe.TIME_1, timeEntrante: LadoEquipe.TIME_2, placarTime1: 2, placarTime2: 1, resultado: ResultadoPartida.TIME_1, timeVencedor: LadoEquipe.TIME_1, timeSaiu: LadoEquipe.TIME_2, encerradaEm: new Date() } })
    await tx.gol.createMany({ data: [{ partidaId: oldMatch.id, participacaoId: participations[0], lado: LadoEquipe.TIME_1, ordemEvento: 1 }, { partidaId: oldMatch.id, participacaoId: participations[1], lado: LadoEquipe.TIME_2, ordemEvento: 2 }, { partidaId: oldMatch.id, participacaoId: participations[2], lado: LadoEquipe.TIME_1, ordemEvento: 3 }] })
    const liveMatch = await tx.partida.create({ data: { rodadaId: round.id, cicloId: cycle2.id, numero: 2, status: StatusPartida.EM_ANDAMENTO, timePermanente: LadoEquipe.TIME_1, timeEntrante: LadoEquipe.TIME_2, placarTime1: 2, placarTime2: 1 } })
    await tx.gol.createMany({ data: [{ partidaId: liveMatch.id, participacaoId: participations[0], lado: LadoEquipe.TIME_1, ordemEvento: 1 }, { partidaId: liveMatch.id, participacaoId: participations[1], lado: LadoEquipe.TIME_2, ordemEvento: 2 }, { partidaId: liveMatch.id, participacaoId: participations[0], lado: LadoEquipe.TIME_1, ordemEvento: 3 }] })
    return { roundId: round.id, playerIds }
  })
  await writeFile(stateFile, JSON.stringify(result), 'utf8')
  console.log(result.roundId)
} else if (action === 'cleanup') {
  const saved = JSON.parse(await readFile(stateFile, 'utf8'))
  if (!saved.roundId || !Array.isArray(saved.playerIds) || saved.playerIds.length !== 16) throw new Error('Estado visual inválido')
  const round = await prisma.rodada.findUnique({ where: { id: saved.roundId } })
  const players = await prisma.jogador.findMany({ where: { id: { in: saved.playerIds } } })
  if (!round || round.data.toISOString().slice(0, 10) !== '2099-11-04' || players.length !== 16 || players.some((item) => !item.nome.startsWith('Visual Etapa 4 Jogador '))) throw new Error('Alvo visual não corresponde aos dados da Etapa 4')
  await prisma.$transaction(async (tx) => { await tx.partida.deleteMany({ where: { rodadaId: saved.roundId } }); await tx.cicloRodada.deleteMany({ where: { rodadaId: saved.roundId } }); await tx.permanenciaRodada.deleteMany({ where: { rodadaId: saved.roundId } }); await tx.rodada.delete({ where: { id: saved.roundId } }); await tx.jogador.deleteMany({ where: { id: { in: saved.playerIds } } }) })
  await unlink(stateFile)
  console.log('Dados visuais da Etapa 4 removidos')
} else throw new Error('Use setup ou cleanup')

await prisma.$disconnect()
