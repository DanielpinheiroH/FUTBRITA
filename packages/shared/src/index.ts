import { z } from 'zod'

const telefone = z.string().trim().transform((value) => value.replace(/\D/g, '')).pipe(
  z.string().regex(/^(?:55)?[1-9]{2}9?\d{8}$/, 'Telefone brasileiro inválido'),
)

export const MAX_PLAYER_PHOTO_DATA_URL_LENGTH = 600_000
const fotoUrl = z.string()
  .max(MAX_PLAYER_PHOTO_DATA_URL_LENGTH, 'A foto ficou muito grande')
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Formato de foto inválido')

export const jogadorCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  apelido: z.string().trim().min(1, 'Apelido é obrigatório').max(60),
  telefone,
  fotoUrl: fotoUrl.nullable().optional(),
})

export const jogadorUpdateSchema = jogadorCreateSchema.partial().extend({ ativo: z.boolean().optional() })

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').transform((value) => value.toLowerCase()),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export type JogadorCreateInput = z.input<typeof jogadorCreateSchema>
export type JogadorUpdateInput = z.input<typeof jogadorUpdateSchema>

export interface JogadorPublico {
  id: string
  nome: string
  apelido: string
  fotoUrl: string | null
  ativo: boolean
}

export interface JogadorAdmin extends JogadorPublico {
  telefone: string
  createdAt: string
  updatedAt: string
}

export interface ApiErrorResponse {
  error: string
  message: string
  details?: unknown
}

export const statusRodadaSchema = z.enum(['PLANEJADA', 'PREPARACAO', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'])
export const tipoParticipacaoSchema = z.enum(['LINHA', 'GOLEIRO'])
export const statusPagamentoSchema = z.enum(['PENDENTE', 'PAGO'])

const dataRodada = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').refine((value) => {
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data inválida')
const horarioRodada = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido')
const valorRodada = z.coerce.number().positive('Valor deve ser maior que zero').max(9999).multipleOf(0.01)

export const rodadaCreateSchema = z.object({
  data: dataRodada,
  horario: horarioRodada.default('20:00'),
  valorJogadorLinha: valorRodada.default(11),
})
export const rodadaUpdateSchema = z.object({
  data: dataRodada.optional(),
  horario: horarioRodada.optional(),
  valorJogadorLinha: valorRodada.optional(),
  status: statusRodadaSchema.optional(),
})
export const participacaoCreateSchema = z.object({
  jogadorId: z.string().uuid('Jogador inválido'),
  tipo: tipoParticipacaoSchema.default('LINHA'),
  confirmado: z.boolean().default(true),
  presente: z.boolean().default(false),
})
export const participacaoUpdateSchema = z.object({
  tipo: tipoParticipacaoSchema.optional(),
  confirmado: z.boolean().optional(),
  presente: z.boolean().optional(),
})
export const jogadorRapidoSchema = jogadorCreateSchema.extend({
  tipo: tipoParticipacaoSchema.default('LINHA'),
  confirmado: z.boolean().default(true),
  presente: z.boolean().default(true),
})
export const pagamentoUpdateSchema = z.object({ status: statusPagamentoSchema })

export type StatusRodada = z.infer<typeof statusRodadaSchema>
export type TipoParticipacao = z.infer<typeof tipoParticipacaoSchema>
export type StatusPagamento = z.infer<typeof statusPagamentoSchema>

export interface PagamentoAdmin {
  id: string
  valor: number
  status: StatusPagamento
  pagoEm: string | null
}

export interface ParticipacaoAdmin {
  id: string
  tipo: TipoParticipacao
  confirmado: boolean
  presente: boolean
  ordemChegada: number | null
  chegouEm: string | null
  saiuEm: string | null
  jogador: JogadorAdmin
  pagamento: PagamentoAdmin | null
}

export interface ResumoFinanceiro {
  totalParticipantes: number
  linhasPresentes: number
  goleirosPresentes: number
  ausentes: number
  totalPrevisto: number
  totalRecebido: number
  totalPendente: number
}

export interface RodadaAdmin {
  id: string
  data: string
  horario: string
  status: StatusRodada
  valorJogadorLinha: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  endedAt: string | null
  participacoes: ParticipacaoAdmin[]
  resumo: ResumoFinanceiro
}

export interface RodadaListaItem {
  id: string
  data: string
  horario: string
  status: StatusRodada
  valorJogadorLinha: number
  totalParticipantes: number
}

export interface ParticipacaoPublica {
  id: string
  tipo: TipoParticipacao
  confirmado: boolean
  presente: boolean
  jogador: Pick<JogadorPublico, 'id' | 'nome' | 'apelido' | 'fotoUrl'>
}

export interface RodadaPublica {
  id: string
  data: string
  horario: string
  status: StatusRodada
  participacoes: ParticipacaoPublica[]
  estadoJogo?: EstadoJogo | null
  partidaAtual?: Partida | null
}

export type StatusPartida = 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA'
export type ResultadoPartida = 'TIME_1' | 'TIME_2' | 'EMPATE'
export type LadoEquipe = 'TIME_1' | 'TIME_2'

export interface JogadorPartida {
  participacaoId: string
  nome: string
  apelido: string
  lado: LadoEquipe
}

export interface GolPartida {
  id: string
  participacaoId: string
  nome: string
  apelido: string
  lado: LadoEquipe
  ordem: number
  createdAt: string
  updatedAt: string
}

export interface Partida {
  id: string
  rodadaId: string
  cicloId: string
  ciclo: number
  numero: number
  status: StatusPartida
  timePermanente: LadoEquipe
  timeEntrante: LadoEquipe
  placarTime1: number
  placarTime2: number
  resultado: ResultadoPartida | null
  timeVencedor: LadoEquipe | null
  timeSaiu: LadoEquipe | null
  iniciadaEm: string
  encerradaEm: string | null
  time1: JogadorPartida[]
  time2: JogadorPartida[]
  fila: JogadorPartida[]
  gols: GolPartida[]
}

export interface JogadorJogo {
  participacaoId: string
  nome: string
  apelido: string
  ordemChegada: number
}

export interface EstadoJogo {
  rodadaId: string
  ciclo: number
  versao: number
  time1: JogadorJogo[]
  time2: JogadorJogo[]
  fila: JogadorJogo[]
  completo: boolean
}

export interface ChegadaJogador extends JogadorJogo {
  chegouEm: string
}

export type RankingType = 'goals' | 'wins' | 'winRate' | 'games' | 'appearances' | 'goalAverage' | 'streak'

export interface MetricasJogador {
  jogador: JogadorPublico
  partidas: number
  vitorias: number
  empates: number
  derrotas: number
  gols: number
  mediaGols: number
  pontos: number
  aproveitamento: number
  presencas: number
  sequenciaAtual: number
  maiorSequencia: number
}

export interface PartidaHistoricoJogador {
  partidaId: string
  numero: number
  lado: LadoEquipe
  resultado: ResultadoPartida
  desempenho: 'VITORIA' | 'EMPATE' | 'DERROTA'
  placarTime1: number
  placarTime2: number
  gols: number
}

export interface RodadaHistoricoJogador {
  rodadaId: string
  data: string
  partidas: number
  vitorias: number
  empates: number
  derrotas: number
  gols: number
  jogos: PartidaHistoricoJogador[]
}

export interface EstatisticasJogador extends MetricasJogador {
  filtro: { scope: 'all' | 'season' | 'round'; season?: number; roundId?: string }
  temporadas: number[]
  historicoRecente: RodadaHistoricoJogador[]
}

export interface RankingPublico {
  tipo: RankingType
  filtro: EstatisticasJogador['filtro']
  minGames: number
  itens: Array<MetricasJogador & { posicao: number }>
}

export interface ResumoPartidaPublica {
  id: string
  numero: number
  placarTime1: number
  placarTime2: number
  resultado: ResultadoPartida
  time1: JogadorPartida[]
  time2: JogadorPartida[]
  gols: GolPartida[]
}

export interface ResumoRodadaPublica {
  id: string
  data: string
  participantes: number
  jogadoresLinha: number
  goleiros: number
  partidas: number
  gols: number
  jogos: ResumoPartidaPublica[]
  destaques: {
    artilheiro: MetricasJogador | null
    maisVitorias: MetricasJogador | null
    maisJogos: MetricasJogador | null
  }
  ranking: MetricasJogador[]
}

export interface ResumoPublicoGeral {
  rodadaAtual: { id: string; data: string; participantes: number } | null
  ultimaRodada: { id: string; data: string; partidas: number; gols: number } | null
  destaquesTemporada: {
    temporada: number
    artilheiro: MetricasJogador | null
    maisVitorias: MetricasJogador | null
    melhorAproveitamento: MetricasJogador | null
  }
}

export interface HistoricoRodadaItem {
  id: string
  data: string
  participantes: number
  jogadoresLinha: number
  goleiros: number
  partidas: number
  gols: number
}
