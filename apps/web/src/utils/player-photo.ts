import { MAX_PLAYER_PHOTO_DATA_URL_LENGTH } from '@fut-brita/shared'

const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_EDGE = 640

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato de imagem não suportado.')) }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto.')), 'image/webp', quality)
  })
}

export async function preparePlayerPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('A foto original deve ter no máximo 12 MB.')
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Seu navegador não conseguiu preparar a foto.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.82, 0.68, 0.52]) {
    const result = await readAsDataUrl(await canvasBlob(canvas, quality))
    if (result.length <= MAX_PLAYER_PHOTO_DATA_URL_LENGTH) return result
  }
  throw new Error('A foto ficou muito grande. Escolha outra imagem.')
}
