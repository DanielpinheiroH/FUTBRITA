const cdpUrl = 'http://127.0.0.1:9230'

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await fetch(`${cdpUrl}/json/list`).then((response) => response.json())
      const page = targets.find((item) => item.type === 'page')
      if (page) return page
    } catch { /* aguardando navegador */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Navegador de validação PWA indisponível')
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
    const callback = pending.get(message.id); pending.delete(message.id)
    message.error ? callback?.reject(new Error(message.error.message)) : callback?.resolve(message.result)
  } else {
    const listeners = events.get(message.method) ?? []; events.delete(message.method); listeners.forEach((resolve) => resolve(message.params))
  }
})
const send = (method, params = {}) => { const id = ++nextId; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
const once = (method) => new Promise((resolve) => events.set(method, [...(events.get(method) ?? []), resolve]))

await send('Page.enable')
const loaded = once('Page.loadEventFired')
await send('Page.navigate', { url: 'http://localhost:4173/' })
await loaded
const evaluation = await send('Runtime.evaluate', {
  expression: `(async () => {
    const registration = await navigator.serviceWorker.ready
    const manifestUrl = document.querySelector('link[rel="manifest"]')?.href
    const manifestResponse = await fetch(manifestUrl)
    const manifest = await manifestResponse.json()
    const iconStatuses = await Promise.all(manifest.icons.map(async (icon) => ({ src: icon.src, status: (await fetch(icon.src)).status })))
    const robotsResponse = await fetch('/robots.txt')
    return {
      title: document.title,
      manifestStatus: manifestResponse.status,
      manifestName: manifest.name,
      display: manifest.display,
      icons: iconStatuses,
      serviceWorkerScope: registration.scope,
      serviceWorkerActive: Boolean(registration.active),
      robotsStatus: robotsResponse.status,
      robots: await robotsResponse.text(),
      metaRobots: document.querySelector('meta[name="robots"]')?.content,
    }
  })()`,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(evaluation.result.value, null, 2))
await send('Browser.close')
