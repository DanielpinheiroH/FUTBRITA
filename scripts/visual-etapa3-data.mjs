import { readFile, unlink, writeFile } from 'node:fs/promises'
import 'dotenv/config'
import { PrismaClient, LadoEquipe, StatusRodada, TipoParticipacao } from '@prisma/client'

const prisma = new PrismaClient()
const stateFile = new URL('../.tmp-etapa3-visual.json', import.meta.url)
const action = process.argv[2]

if (action === 'setup') {
  const suffix = Date.now().toString()
  const admin = await prisma.admin.findUniqueOrThrow({ where: { email: 'admin@futbrita.local' } })
  const result = await prisma.$transaction(async (tx) => {
    const round = await tx.rodada.create({ data: { data: new Date('2099-10-06T00:00:00Z'), horario: new Date('1970-01-01T20:00:00Z'), status: StatusRodada.EM_ANDAMENTO, valorJogadorLinha: 11, createdBy: admin.id, startedAt: new Date() } })
    const participations = []
    const playerIds = []
    for (let index = 1; index <= 16; index++) {
      const jogador = await tx.jogador.create({ data: { nome: `Visual Etapa 3 Jogador ${index} ${suffix}`, apelido: `Brita ${index}`, telefone: `619${String(10000000 + index)}` } })
      playerIds.push(jogador.id)
      const participation = await tx.participacaoRodada.create({ data: { rodadaId: round.id, jogadorId: jogador.id, tipo: TipoParticipacao.LINHA, confirmado: true, presente: true, ordemChegada: index, chegouEm: new Date() } })
      await tx.pagamento.create({ data: { participacaoId: participation.id, valor: 11, updatedBy: admin.id } })
      participations.push(participation.id)
    }
    const state = await tx.estadoRodadaJogo.create({ data: { rodadaId: round.id } })
    const cycle = await tx.cicloRodada.create({ data: { rodadaId: round.id, numero: 1 } })
    await tx.escalacaoCiclo.createMany({ data: participations.slice(0, 12).map((participacaoId, index) => ({ cicloId: cycle.id, participacaoId, lado: index % 2 === 0 ? LadoEquipe.TIME_1 : LadoEquipe.TIME_2 })) })
    await tx.filaCiclo.createMany({ data: participations.slice(12).map((participacaoId, index) => ({ cicloId: cycle.id, participacaoId, posicao: index + 1 })) })
    await tx.permanenciaRodada.createMany({ data: participations.map((participacaoId) => ({ rodadaId: round.id, participacaoId })) })
    return { roundId: round.id, stateId: state.id, playerIds }
  })
  await writeFile(stateFile, JSON.stringify(result), 'utf8')
  console.log(result.roundId)
} else if (action === 'cleanup') {
  const saved = JSON.parse(await readFile(stateFile, 'utf8'))
  if (!saved.roundId || !Array.isArray(saved.playerIds) || saved.playerIds.length !== 16) throw new Error('Estado visual inválido')
  const round = await prisma.rodada.findUnique({ where: { id: saved.roundId } })
  if (!round || round.data.toISOString().slice(0, 10) !== '2099-10-06') throw new Error('Rodada visual não corresponde ao alvo esperado')
  const players = await prisma.jogador.findMany({ where: { id: { in: saved.playerIds } } })
  if (players.length !== 16 || players.some((item) => !item.nome.startsWith('Visual Etapa 3 Jogador '))) throw new Error('Jogadores visuais não correspondem ao alvo esperado')
  await prisma.$transaction(async (tx) => { await tx.cicloRodada.deleteMany({ where: { rodadaId: saved.roundId } }); await tx.permanenciaRodada.deleteMany({ where: { rodadaId: saved.roundId } }); await tx.rodada.delete({ where: { id: saved.roundId } }); await tx.jogador.deleteMany({ where: { id: { in: saved.playerIds } } }) })
  await unlink(stateFile)
  console.log('Dados visuais removidos')
} else {
  throw new Error('Use setup ou cleanup')
}

await prisma.$disconnect()
