import { mkdir, writeFile } from 'node:fs/promises'
import 'dotenv/config'

const cdpUrl = 'http://127.0.0.1:9226'
const outputDir = new URL('../artifacts/responsive/', import.meta.url)
const roundId = process.argv[2]
if (!roundId) throw new Error('Informe roundId')
await mkdir(outputDir, { recursive: true })

const login = await fetch('http://localhost:3333/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_INITIAL_EMAIL, senha: process.env.ADMIN_INITIAL_PASSWORD }) })
if (!login.ok) throw new Error(`Login visual falhou: ${login.status}`)
const setCookie = login.headers.getSetCookie?.()[0] ?? login.headers.get('set-cookie')
const sessionCookie = setCookie?.match(/fut_brita_session=([^;]+)/)?.[1]
if (!sessionCookie) throw new Error('Cookie visual não recebido')

async function waitForTarget() { for (let attempt = 0; attempt < 40; attempt++) { try { const targets = await fetch(`${cdpUrl}/json/list`).then((response) => response.json()); const page = targets.find((item) => item.type === 'page'); if (page) return page } catch { /* iniciando */ } await new Promise((resolve) => setTimeout(resolve, 250)) } throw new Error('Chromium não disponibilizou o alvo') }
const target = await waitForTarget(); const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let nextId = 0; const pending = new Map(); const events = new Map()
socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback?.reject(new Error(message.error.message)) : callback?.resolve(message.result) } else { const listeners = events.get(message.method) ?? []; events.delete(message.method); listeners.forEach((resolve) => resolve(message.params)) } })
const send = (method, params = {}) => { const id = ++nextId; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
const once = (method) => new Promise((resolve) => events.set(method, [...(events.get(method) ?? []), resolve]))
async function navigate(url) { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 700)) }
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
async function capture(name) { const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }); await writeFile(new URL(name, outputDir), Buffer.from(shot.data, 'base64')) }

await send('Page.enable'); await send('Network.enable'); await send('Network.setCookie', { name: 'fut_brita_session', value: sessionCookie, url: 'http://localhost:3333/', httpOnly: true, sameSite: 'Lax' })
const viewports = [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]; const report = []
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, screenWidth: viewport.width, screenHeight: viewport.height, mobile: viewport.width < 600 })
  await navigate(`http://localhost:5173/admin/rodadas/${roundId}/jogo`)
  const metrics = await evaluate(`({path:location.pathname,innerWidth,scrollWidth:document.documentElement.scrollWidth,live:document.body.innerText.toUpperCase().includes('EM ANDAMENTO'),score:document.body.innerText.includes('2')&&document.body.innerText.includes('1'),advantage:document.body.innerText.toUpperCase().includes('VANTAGEM DO EMPATE'),entrant:document.body.innerText.toUpperCase().includes('ENTROU AGORA'),queue:document.body.innerText.toUpperCase().includes('PRÓXIMOS / FILA'),history:document.body.innerText.toUpperCase().includes('PARTIDAS'),goalButtons:[...document.querySelectorAll('button')].filter(b=>/Gol Time/i.test(b.textContent)).length,finish:[...document.querySelectorAll('button')].some(b=>/Finalizar partida/i.test(b.textContent)),minPrimaryTouch:Math.min(...[...document.querySelectorAll('button')].filter(b=>/Gol Time|Finalizar partida/i.test(b.textContent)&&b.offsetParent).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height)))})`)
  report.push({ page: 'admin-live', viewport: `${viewport.width}x${viewport.height}`, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.innerWidth })
  await capture(`etapa4-jogo-${viewport.width}x${viewport.height}.png`)
  if (viewport.width === 390) { await evaluate(`[...document.querySelectorAll('button')].find(b=>/Gol Time 1/i.test(b.textContent))?.click()`); await new Promise((resolve) => setTimeout(resolve, 250)); const modal = await evaluate(`({dialog:!!document.querySelector('[role=dialog]'),players:document.querySelectorAll('[role=dialog] button').length-1,maxHeight:document.querySelector('[role=dialog]')?.getBoundingClientRect().height,viewportHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth})`); report.push({ page: 'goal-picker', viewport: '390x844', ...modal, horizontalOverflow: modal.scrollWidth > 390 }); await capture('etapa4-gol-modal-390x844.png'); await evaluate(`document.querySelector('[role=dialog] header button')?.click()`) }
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, screenWidth: 390, screenHeight: 844, mobile: true }); await navigate('http://localhost:5173/rodada')
const publicMetrics = await evaluate(`({innerWidth,scrollWidth:document.documentElement.scrollWidth,live:document.body.innerText.toUpperCase().includes('JOGO ATUAL'),score:document.body.innerText.includes('2')&&document.body.innerText.includes('1'),goals:document.body.innerText.toUpperCase().includes('GOLS TIME 1'),formation:document.body.innerText.toUpperCase().includes('FORMAÇÃO ATUAL'),queue:document.body.innerText.toUpperCase().includes('FILA'),privateLeak:/\btelefone\b|\bpagamento\b|\bsenha\b|\bauditoria\b|marcar pago/i.test(document.body.innerText)})`)
report.push({ page: 'public-live', viewport: '390x844', ...publicMetrics, horizontalOverflow: publicMetrics.scrollWidth > publicMetrics.innerWidth }); await capture('etapa4-public-390x844.png')
console.log(JSON.stringify(report, null, 2)); await send('Browser.close')
