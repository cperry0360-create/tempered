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
const VIEWS = ['setup-welcome', 'setup-rhythm', 'today', 'train', 'fuel', 'progress']
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

function runChrome(chrome, args, timeoutMs = 35000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      rejectRun(new Error('Chromium screenshot timed out'))
    }, timeoutMs)
    child.on('error', (error) => { clearTimeout(timer); rejectRun(error) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolveRun()
      else rejectRun(new Error(`Chromium exited ${code}: ${stderr.slice(-1200)}`))
    })
  })
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
const { server, port, nextReport } = await serve()
const manifest = []

try {
  for (const viewport of VIEWPORTS) {
    for (const view of VIEWS) {
      const filename = `${viewport.label}-${view}.png`
      const destination = join(output, filename)
      const reportPromise = nextReport()
      const url = `http://127.0.0.1:${port}/test/browser/release-visual.html?view=${encodeURIComponent(view)}`
      await Promise.all([
        reportPromise.then((report) => {
          if (report.view !== view || report.ok !== true) {
            throw new Error(`${view} did not render: ${report.error || 'unknown visual error'}`)
          }
        }),
        runChrome(chrome, [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
          '--force-device-scale-factor=1', `--window-size=${viewport.width},${viewport.height}`,
          `--user-data-dir=${profile}`, '--virtual-time-budget=3000',
          `--screenshot=${destination}`, url,
        ]),
      ])
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
  server.close()
  await rm(profile, { recursive: true, force: true })
}
