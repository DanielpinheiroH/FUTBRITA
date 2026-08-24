import { mkdir, writeFile } from 'node:fs/promises'

const cdpUrl = 'http://127.0.0.1:9225'
const outputDir = new URL('../artifacts/responsive/', import.meta.url)
const roundId = process.argv[2]
const sessionCookie = process.env.VISUAL_SESSION_COOKIE
if (!roundId || !sessionCookie) throw new Error('Informe roundId e VISUAL_SESSION_COOKIE')
await mkdir(outputDir, { recursive: true })

async function waitForTarget() { for (let attempt = 0; attempt < 40; attempt++) { try { const targets = await fetch(`${cdpUrl}/json/list`).then((response) => response.json()); const page = targets.find((item) => item.type === 'page'); if (page) return page } catch { /* iniciando */ } await new Promise((resolve) => setTimeout(resolve, 250)) } throw new Error('Chromium não disponibilizou o alvo') }
const target = await waitForTarget(); const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let nextId = 0; const pending = new Map(); const events = new Map()
socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback?.reject(new Error(message.error.message)) : callback?.resolve(message.result) } else { const listeners = events.get(message.method) ?? []; events.delete(message.method); listeners.forEach((resolve) => resolve(message.params)) } })
const send = (method, params = {}) => { const id = ++nextId; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
const once = (method) => new Promise((resolve) => events.set(method, [...(events.get(method) ?? []), resolve]))
async function navigate(url) { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 700)) }
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
async function capture(name) { const image = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }); await writeFile(new URL(name, outputDir), Buffer.from(image.data, 'base64')) }

await send('Page.enable'); await send('Network.enable'); await send('Network.setCookie', { name: 'fut_brita_session', value: sessionCookie, url: 'http://localhost:3333/', httpOnly: true, sameSite: 'Lax' })
const viewports = [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]; const report = []
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, screenWidth: viewport.width, screenHeight: viewport.height, mobile: viewport.width < 600 })
  await navigate(`http://localhost:5173/admin/rodadas/${roundId}`)
  await evaluate(`document.querySelector('#game-title')?.scrollIntoView({block:'start'})`); await new Promise((resolve) => setTimeout(resolve, 250))
  const metrics = await evaluate(`({path:location.pathname,innerWidth,scrollWidth:document.documentElement.scrollWidth,hasTeam1:document.body.innerText.includes('Time 1'),hasTeam2:document.body.innerText.includes('Time 2'),hasQueue:document.body.innerText.includes('Fila'),hasRotation:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Time 1 sai')),hasExit:[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')?.includes('Marcar saída')),minButton:Math.min(...[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height)))})`)
  if (metrics.path !== `/admin/rodadas/${roundId}`) throw new Error(`Redirecionamento inesperado: ${metrics.path}`)
  report.push({ page: 'admin-game', viewport: `${viewport.width}x${viewport.height}`, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.innerWidth })
  await capture(`etapa3-admin-${viewport.width}x${viewport.height}.png`)
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, screenWidth: 390, screenHeight: 844, mobile: true }); await navigate('http://localhost:5173/rodada'); await evaluate(`document.querySelector('h2')?.scrollIntoView({block:'start'})`)
const publicMetrics = await evaluate(`({innerWidth,scrollWidth:document.documentElement.scrollWidth,hasFormation:document.body.innerText.includes('Formação atual'),hasTeam1:document.body.innerText.includes('Time 1'),hasQueue:document.body.innerText.includes('Fila'),privateLeak:/telefone|pagamento|permanência|Marcar saída|Time 1 sai/i.test(document.body.innerText)})`)
report.push({ page: 'public-game', viewport: '390x844', ...publicMetrics, horizontalOverflow: publicMetrics.scrollWidth > publicMetrics.innerWidth }); await capture('etapa3-public-390x844.png')
console.log(JSON.stringify(report, null, 2)); await send('Browser.close')
