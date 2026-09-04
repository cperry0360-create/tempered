/**
 * The service worker's precache list is hand-written, because there is no build
 * step to derive it from. That makes it exactly the kind of thing that rots: add
 * a module, forget the list, and the app breaks offline — but only offline, and
 * only for people who already installed it.
 *
 * So the list is checked against reality instead of trusted.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const sw = readFileSync(root + 'sw.js', 'utf8')

const precache = [...sw.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1])

/**
 * What the app actually loads, by walking the import graph from the entry point.
 *
 * Deliberately not "every .js under src/": that would demand precaching
 * type-only declaration modules and the balance-projection harness, none of
 * which the browser ever fetches. The question is what a cold offline start
 * needs, and only the import graph answers it.
 */
function loadedModules(entry = 'src/main.js', seen = new Set()) {
  if (seen.has(entry)) return seen
  seen.add(entry)
  const source = readFileSync(root + entry, 'utf8')
  const dir = entry.slice(0, entry.lastIndexOf('/'))
  for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
    const resolved = new URL(match[1], `file:///${dir}/`).pathname.slice(1)
    loadedModules(resolved, seen)
  }
  return seen
}

test('every module the app actually loads is precached', () => {
  const loaded = [...loadedModules()].sort()
  assert.ok(loaded.length > 15, `only walked ${loaded.length} modules — is the entry point right?`)
  const missing = loaded.filter((file) => !precache.includes(file))
  assert.deepEqual(missing, [], 'add these to PRECACHE in sw.js, or the app breaks offline')
})

/** Assets index.html pulls in directly, which no import graph can see. */
function htmlAssets() {
  const html = readFileSync(root + 'index.html', 'utf8')
  return [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((match) => match[1])
}

test('the precache list carries nothing the app never loads', () => {
  // Not a correctness bug, but dead entries mislead the next person to edit it.
  const loaded = new Set([...loadedModules(), ...htmlAssets()])
  const strays = precache.filter((path) => path.startsWith('src/') && !loaded.has(path))
  assert.deepEqual(strays, [], 'these are precached but never imported')
})

test('every precached path actually exists', () => {
  const broken = precache.filter((path) => {
    if (path === '' || path.endsWith('/')) return false
    try { readFileSync(root + path); return false } catch { return true }
  })
  assert.deepEqual(broken, [], 'these are precached but not in the repo')
})

test('the data files the app fetches at runtime are precached', () => {
  for (const file of ['data/balance.json', 'data/exercises.json']) {
    assert.ok(precache.includes(file), `${file} must be precached — the app fetches it on boot`)
  }
})

test('the shell itself is precached', () => {
  for (const path of ['index.html', 'manifest.webmanifest', 'src/style.css']) {
    assert.ok(precache.includes(path), `${path} is missing from PRECACHE`)
  }
})
