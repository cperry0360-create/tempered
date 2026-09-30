#!/usr/bin/env node
/**
 * Capture the release-critical UI at both supported iPhone viewport classes.
 *
 * The page reports successful rendering before a capture counts. The PNGs are
 * evidence for direct visual inspection, not a substitute for that inspection.
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
}
const VIEWS = ['setup-welcome', 'setup-rhythm', 'setup-plan', 'today', 'train', 'session', 'fuel', 'progress', 'settings', 'program-builder', 'companion']
const VIEWPORTS = [
  { label: 'iphone-compact', width: 390, height: 844 },
  { label: 'iphone-large', width: 430, height: 932 },
]

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

function findChrome() {
  return argument('--chrome') ?? [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((path) => existsSync(path)) ?? null
}

function serve() {
  let pending = null
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/__visual-ready') {
      let body = ''
      for await (const chunk of request) body += chunk
      response.writeHead(200).end('ok')
      try { pending?.resolve(JSON.parse(body)) } catch (error) { pending?.reject(error) }
      return
    }
    try {
      const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname))
      if (path.includes('..')) { response.writeHead(403).end(); return }
      const body = await readFile(join(root, path === '/' ? 'index.html' : path))
      response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404).end('not found')
    }
  })

  function nextReport(timeoutMs = 30000) {
    return new Promise((resolveReport, rejectReport) => {
      const timer = setTimeout(() => rejectReport(new Error('visual page never reported ready')), timeoutMs)
      pending = {
        resolve: (value) => { clearTimeout(timer); pending = null; resolveReport(value) },
        reject: (error) => { clearTimeout(timer); pending = null; rejectReport(error) },
      }
    })
  }

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer({ server, port: server.address().port, nextReport }))
  })
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

function availablePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer()
    probe.once('error', rejectPort)
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port
      probe.close((error) => error ? rejectPort(error) : resolvePort(port))
    })
  })
}

async function activeDebugPort(profile, browserError, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  const marker = join(profile, 'DevToolsActivePort')
  while (Date.now() < deadline) {
    try {
      const [portLine] = (await readFile(marker, 'utf8')).trim().split(/\r?\n/)
      const port = Number(portLine)
      if (Number.isInteger(port) && port > 0) return port
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(`Chromium did not publish DevToolsActivePort: ${lastError?.message ?? 'timeout'}\n${browserError()}`)
}

async function devToolsPage(port, browserError, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(`Chromium did not expose a page: ${lastError?.message ?? 'timeout'}\n${browserError()}`)
}

async function connectCdp(url) {
  if (typeof WebSocket !== 'function') throw new Error('This release gate requires Node with WebSocket support')
  const socket = new WebSocket(url)
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', () => rejectOpen(new Error('Could not connect to Chromium')), { once: true })
  })

  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    clearTimeout(request.timer)
    if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`))
    else request.resolve(message.result ?? {})
  })

  function send(method, params = {}) {
    return new Promise((resolveSend, rejectSend) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        rejectSend(new Error(`${method} timed out`))
      }, 20000)
      pending.set(id, { method, timer, resolve: resolveSend, reject: rejectSend })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  return { send, close: () => socket.close() }
}

async function pngDimensions(path) {
  const bytes = await readFile(path)
  const signature = bytes.subarray(1, 4).toString('ascii')
  if (signature !== 'PNG') throw new Error(`${path} is not a PNG`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length }
}

const chrome = findChrome()
if (!chrome) {
  console.error('No Chromium or Chrome binary found. Pass one with --chrome /path/to/chrome.')
  process.exit(2)
}

const output = resolve(argument('--output', join(root, 'artifacts/release-visuals')))
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'tempered-release-visual-'))
const debugPort = await availablePort()
const { server, port, nextReport } = await serve()
const manifest = []
let browserError = ''
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })
browser.stderr.on('data', (chunk) => { browserError += chunk })
const browserExit = new Promise((resolveExit) => browser.once('close', resolveExit))
let cdp = null

try {
  cdp = await connectCdp(await devToolsPage(debugPort, () => browserError.slice(-1600), 30000))
  await cdp.send('Page.enable')
  for (const viewport of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    })
    for (const view of VIEWS) {
      const filename = `${viewport.label}-${view}.png`
      const destination = join(output, filename)
      const reportPromise = nextReport()
      const url = `http://127.0.0.1:${port}/test/browser/release-visual.html?view=${encodeURIComponent(view)}`
      await cdp.send('Page.navigate', { url })
      const report = await reportPromise
      if (report.view !== view || report.ok !== true) {
        throw new Error(`${view} did not render: ${report.error || 'unknown visual error'}`)
      }
      await delay(100)
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: false,
      })
      if (!screenshot.data) throw new Error(`${view} returned no screenshot data`)
      await writeFile(destination, Buffer.from(screenshot.data, 'base64'))
      const image = await pngDimensions(destination)
      if (image.width !== viewport.width || image.height !== viewport.height || image.bytes < 5000) {
        throw new Error(`${filename} is ${image.width}×${image.height} and ${image.bytes} bytes`)
      }
      manifest.push({ view, viewport: viewport.label, ...image, file: filename })
      console.log(`CAPTURED ${filename} (${image.bytes} bytes)`)
    }
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), captures: manifest }, null, 2)}\n`)
  console.log(`\nRESULT: ${manifest.length} release visuals captured in ${output}`)
} finally {
  cdp?.close()
  browser.kill('SIGKILL')
  await browserExit
  server.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
