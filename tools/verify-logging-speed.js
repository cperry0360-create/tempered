/**
 * Verifies Phase 3's speed criteria against the real app in a real browser:
 *
 *   - a full lower-body session in under 90 seconds of tapping
 *   - an ad-hoc set of curls in under 20 seconds from app open
 *   - last performance and PR visible before the first set is entered
 *
 *   node tools/verify-logging-speed.js [--chrome /path/to/chrome]
 *     [--page test/browser/<harness>.html] [--window 390,844]
 *
 * The harness drives the actual UI and counts taps; a script's wall clock is
 * meaningless, so taps are converted at a stated one second per tap.
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json',
}

function serve() {
  let pending = null
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/__report') {
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

  // CI can spend tens of seconds starting Chromium under load. The product
  // timing assertions live inside the harnesses; this outer timeout is only a
  // watchdog for "never reported at all", so give startup a generous window.
  function nextReport(timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the harness never reported back')), timeoutMs)
      pending = {
        resolve: (v) => { clearTimeout(timer); pending = null; resolve(v) },
        reject: (e) => { clearTimeout(timer); pending = null; reject(e) },
      }
    })
  }

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, nextReport }))
  })
}

function findChrome() {
  const index = process.argv.indexOf('--chrome')
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]
  return [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((path) => existsSync(path)) ?? null
}

const chrome = findChrome()
if (!chrome) {
  console.error('No Chromium or Chrome binary found. Pass one with --chrome /path/to/chrome.')
  process.exit(2)
}

const { server, port, nextReport } = await serve()
const page = process.argv.includes('--page')
  ? process.argv[process.argv.indexOf('--page') + 1]
  : 'test/browser/logging-speed.html'
const url = `http://127.0.0.1:${port}/${page}`
console.log(`Driving the real app at ${url}\n`)

// A viewport can be stated: `--window 390,844`. It matters for anything
// measured as a fraction of the screen — docs/04's acid budget is "under 5% of
// the viewport", which is only a real number at a size a phone actually has.
const windowSize = process.argv.includes('--window')
  ? process.argv[process.argv.indexOf('--window') + 1]
  : null

const child = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  ...(windowSize ? [`--window-size=${windowSize}`] : []),
  url,
], { stdio: 'ignore' })

let passed = false
try {
  const result = await nextReport()
  let failures = 0
  for (const { name, ok, detail } of result.checks) {
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
  }
  console.log(`\n${result.checks.length} checks, ${failures} failed`)
  passed = failures === 0 && result.passed === true
} finally {
  child.kill('SIGKILL')
  server.close()
}

console.log(passed ? `\nRESULT: ${page} passed.` : `\nRESULT: ${page} FAILED.`)
process.exit(passed ? 0 : 1)
