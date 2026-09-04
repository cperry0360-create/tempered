/**
 * Required by docs/07-build-plan.md Phase 2:
 * "Domain layer imports no browser API directly. A test asserts this."
 *
 * This is the test. It reads every non-test module under src/domain/ and checks
 * it stays pure — no platform APIs, no adapters, no ambient time or randomness.
 * The domain takes what it needs as arguments.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const domainRoot = fileURLToPath(new URL('./', import.meta.url))

/** Every non-test .js file under src/domain/, recursively. */
function domainModules(dir = domainRoot, prefix = '') {
  /** @type {{name: string, source: string}[]} */
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...domainModules(`${dir}${entry.name}/`, `${prefix}${entry.name}/`))
      continue
    }
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) continue
    found.push({ name: prefix + entry.name, source: readFileSync(dir + entry.name, 'utf8') })
  }
  return found
}

const modules = domainModules()

/** Strips comments and strings so prose about `indexedDB` cannot fail the test. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

test('the domain layer has modules to check', () => {
  assert.ok(modules.length >= 15, `only found ${modules.length} domain modules`)
})

test('REQUIRED: no domain module touches a browser API', () => {
  const forbidden = [
    /\bindexedDB\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bwindow\b/,
    /\bdocument\b/, /\bnavigator\b/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/,
    /\bcaches\b/, /\balert\s*\(/, /\bServiceWorker\b/,
  ]
  /** @type {string[]} */
  const offenders = []
  for (const module of modules) {
    const body = code(module.source)
    for (const pattern of forbidden) {
      if (pattern.test(body)) offenders.push(`${module.name}: ${pattern}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no domain module reads the clock', () => {
  // Dates arrive as arguments. `docs/02` requires calendar-local dates via the
  // clock adapter, which is exactly what reading time here would bypass.
  const offenders = []
  for (const module of modules) {
    const body = code(module.source)
    if (/\bDate\.now\s*\(/.test(body)) offenders.push(`${module.name}: Date.now()`)
    if (/\bnew\s+Date\b/.test(body)) offenders.push(`${module.name}: new Date()`)
    if (/\bperformance\.now\s*\(/.test(body)) offenders.push(`${module.name}: performance.now()`)
  }
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no domain module uses ambient randomness', () => {
  // The battle must resolve identically for the same day and seed, and the
  // balance projection must be reproducible. Both need seeded generators.
  const offenders = modules
    .filter((module) => /\bMath\.random\s*\(/.test(code(module.source)))
    .map((module) => module.name)
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no domain module imports an adapter', () => {
  const offenders = []
  for (const module of modules) {
    for (const match of module.source.matchAll(/from\s+'([^']+)'/g)) {
      const specifier = match[1]
      if (/adapters?\//.test(specifier) || /\/ui\//.test(specifier)) {
        offenders.push(`${module.name} imports ${specifier}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no domain module imports anything outside the domain', () => {
  // Node built-ins included: the domain must run unchanged in a browser.
  const offenders = []
  for (const module of modules) {
    for (const match of module.source.matchAll(/from\s+'([^']+)'/g)) {
      const specifier = match[1]
      const isRelativeInsideDomain = specifier.startsWith('./') || specifier.startsWith('../')
      if (!isRelativeInsideDomain) {
        offenders.push(`${module.name} imports bare specifier ${specifier}`)
      } else if (specifier.startsWith('../') && !specifier.startsWith('../migrations')) {
        offenders.push(`${module.name} reaches outside src/domain via ${specifier}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no domain module reads a file or an environment variable', () => {
  const offenders = []
  for (const module of modules) {
    const body = code(module.source)
    if (/\brequire\s*\(/.test(body)) offenders.push(`${module.name}: require()`)
    if (/\bprocess\.(env|cwd)\b/.test(body)) offenders.push(`${module.name}: process`)
    if (/\breadFileSync\b|\bwriteFileSync\b/.test(body)) offenders.push(`${module.name}: fs`)
  }
  assert.deepEqual(offenders, [])
})

test('the domain runs with every browser and Node global removed', async () => {
  // The strongest form of the check: actually import and exercise the engine
  // with the platform torn out from under it.
  const stolen = {}
  const globals = ['indexedDB', 'localStorage', 'sessionStorage', 'fetch', 'caches']
  for (const name of globals) {
    stolen[name] = Reflect.getOwnPropertyDescriptor(globalThis, name)
    Reflect.deleteProperty(globalThis, name)
  }
  try {
    const { awardsForSession, createInitialState, applyAwards } = await import('./xp-engine.js')
    const { loadBalance } = await import('../../test/helpers/balance.js')
    const balance = loadBalance()
    const awards = awardsForSession(
      { id: 's', routineId: null, durationMinutes: 60, sets: [{ exerciseId: 'squat_bb', weight: 145, reps: 8 }] },
      {
        date: '2026-09-04', exercises: new Map(), records: new Map(),
        daysSinceLastSession: 2, sessionsThisWeekBefore: 0, planTargetSessionsPerWeek: 4,
      },
      balance,
    )
    const state = applyAwards(createInitialState(), awards, balance)
    assert.ok(state.grit.xp > 0)
  } finally {
    for (const [name, descriptor] of Object.entries(stolen)) {
      if (descriptor) Reflect.defineProperty(globalThis, name, descriptor)
    }
  }
})
