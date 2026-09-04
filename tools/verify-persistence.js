/**
 * Verifies Phase 2's persistence criterion against a real browser:
 * "Data survives reload, browser restart and app relaunch."
 *
 *   node tools/verify-persistence.js [--chrome /path/to/chrome]
 *
 * Serves the repo, then drives Chromium through three passes against ONE
 * browser profile:
 *
 *   1. write   — writes a fixture, reloads the page, reads it back  (reload)
 *   2. restart — a new browser process, same profile                (restart)
 *   3. relaunch— another new process, to prove it was not a fluke   (relaunch)
 *
 * Needs a Chromium or Chrome binary. Everything else in this repo runs under
 * plain `node --test`; this is separate because it needs a browser with real
 * IndexedDB, which Node does not have.
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, rm, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
}

function serve() {
  /** Set by the driver before each pass; resolved when the page reports in. */
  let pending = null

  const server = createServer(async (request, response) => {
    // The page posts its results here when it has genuinely finished. A DOM
    // snapshot would be taken at the load event, long before IndexedDB settles.
    if (request.method === 'POST' && request.url === '/__report') {
      let body = ''
      for await (const chunk of request) body += chunk
      response.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
      try { pending?.resolve(JSON.parse(body)) } catch (error) { pending?.reject(error) }
      return
    }
    try {
      const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname))
      if (path.includes('..')) { response.writeHead(403).end(); return }
      const file = join(root, path === '/' ? 'index.html' : path)
      const body = await readFile(file)
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404).end('not found')
    }
  })
  /** Resolves with the next report the page posts, or rejects on timeout. */
  function nextReport(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the page never reported back')), timeoutMs)
      pending = {
        resolve: (value) => { clearTimeout(timer); pending = null; resolve(value) },
        reject: (error) => { clearTimeout(timer); pending = null; reject(error) },
      }
    })
  }

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, nextReport }))
  })
}

function findChrome() {
  const flagIndex = process.argv.indexOf('--chrome')
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1]
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  return candidates.find((path) => existsSync(path)) ?? null
}

/** Runs one pass in a fresh browser process, resolving with the page's report. */
async function runPass(chrome, profile, url, nextReport) {
  const child = spawn(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu',
    `--user-data-dir=${profile}`, url,
  ], { stdio: 'ignore' })
  try {
    return await nextReport()
  } finally {
    // Without --dump-dom the browser stays open; the pass is over, so end it.
    child.kill('SIGKILL')
  }
}

function report(result) {
  let failed = 0
  for (const { name, ok, detail } of result.checks) {
    if (!ok) failed += 1
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` \u2014 ${detail}` : ''}`)
  }
  if (result.checks.length === 0) {
    console.log('    FAIL  the harness produced no checks')
    return false
  }
  console.log(`  ${result.checks.length} checks, ${failed} failed`)
  return failed === 0 && result.passed === true
}

const chrome = findChrome()
if (!chrome) {
  console.error('No Chromium or Chrome binary found. Pass one with --chrome /path/to/chrome.')
  process.exit(2)
}

const { server, port, nextReport } = await serve()
const profile = await mkdtemp(join(tmpdir(), 'tempered-persistence-'))
const url = (phase) => `http://127.0.0.1:${port}/test/browser/persistence.html?phase=${phase}`

console.log(`Chromium: ${chrome}`)
console.log(`Serving:  ${root}`)
console.log(`Profile:  ${profile}  (one profile across all three passes)\n`)

let allPassed = true
try {
  for (const [phase, label] of [
    ['write', 'PASS 1 — write, then reload the page in the same session'],
    ['restart', 'PASS 2 — new browser process, same profile (restart)'],
    ['relaunch', 'PASS 3 — another new process (app relaunch)'],
  ]) {
    console.log(label)
    const result = await runPass(chrome, profile, url(phase), nextReport)
    allPassed = report(result) && allPassed
    console.log()
  }
} finally {
  server.close()
  // A killed browser can still be flushing its profile, so deleting it races.
  // Cleanup of a temp directory must never turn a passing run into a failure.
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {
    console.log(`(could not remove the temporary profile at ${profile} — harmless)`)
  }
}

console.log(allPassed
  ? 'RESULT: data survived reload, browser restart and app relaunch.'
  : 'RESULT: FAILED — data did not survive.')
process.exit(allPassed ? 0 : 1)
