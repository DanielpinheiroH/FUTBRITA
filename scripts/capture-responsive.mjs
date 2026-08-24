import { mkdir, writeFile } from 'node:fs/promises'

const cdpUrl = 'http://127.0.0.1:9223'
const outputDir = new URL('../artifacts/responsive/', import.meta.url)
await mkdir(outputDir, { recursive: true })

async function waitForTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const targets = await fetch(`${cdpUrl}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === 'page')
      if (page) return page
    } catch { /* browser ainda iniciando */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Chromium não disponibilizou o alvo de teste')
}

const target = await waitForTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })

let nextId = 0
const pending = new Map()
const events = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) callback?.reject(new Error(message.error.message)); else callback?.resolve(message.result)
  } else {
    const listeners = events.get(message.method) ?? []
    events.delete(message.method)
    listeners.forEach((resolve) => resolve(message.params))
  }
})

function send(method, params = {}) {
  const id = ++nextId
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}
function once(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) ?? []), resolve])) }

await send('Page.enable')
const viewports = [
  { width: 390, height: 844, mobile: true },
  { width: 430, height: 932, mobile: true },
  { width: 768, height: 1024, mobile: false },
  { width: 1440, height: 900, mobile: false },
]
const report = []
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, screenWidth: viewport.width, screenHeight: viewport.height })
  const loaded = once('Page.loadEventFired')
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
  await loaded
  await new Promise((resolve) => setTimeout(resolve, 500))
  const metrics = await send('Runtime.evaluate', { expression: `({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, title: document.title })`, returnByValue: true })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await writeFile(new URL(`${viewport.width}x${viewport.height}.png`, outputDir), Buffer.from(screenshot.data, 'base64'))
  report.push({ viewport: `${viewport.width}x${viewport.height}`, ...metrics.result.value, horizontalOverflow: metrics.result.value.scrollWidth > metrics.result.value.innerWidth })
}
console.log(JSON.stringify(report, null, 2))
await send('Browser.close')
