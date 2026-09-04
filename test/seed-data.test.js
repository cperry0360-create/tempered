import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../data/', import.meta.url))

test('every seed file in data/ parses as JSON', () => {
  const files = readdirSync(dataDir).filter((name) => name.endsWith('.json'))
  assert.ok(files.length > 0, 'expected at least one seed file in data/')

  for (const file of files) {
    assert.doesNotThrow(
      () => JSON.parse(readFileSync(dataDir + file, 'utf8')),
      `data/${file} is not valid JSON`,
    )
  }
})

test('balance.json is an object, not an array or scalar', () => {
  const balance = JSON.parse(readFileSync(`${dataDir}balance.json`, 'utf8'))
  assert.equal(typeof balance, 'object')
  assert.ok(balance !== null && !Array.isArray(balance))
})

/**
 * Exercise art is the one asset class nothing else can vouch for. It is named by
 * exercise id in data/exercises.json, it is not imported by any module, and a
 * wrong or missing file shows up only as a broken image on the session screen —
 * in the gym, mid-set, which is the worst possible place to discover it.
 *
 * So the three things that have to agree are asserted against each other: the
 * file on disk, the `art` field pointing at it, the precache entry keeping it
 * offline, and the provenance row saying where it came from.
 */
const artDir = fileURLToPath(new URL('../art/exercises/', import.meta.url))
const exercisesWithArt = () =>
  JSON.parse(readFileSync(`${dataDir}exercises.json`, 'utf8'))
    .exercises.filter((exercise) => exercise.art)

test('every art file an exercise names is actually in the repo', () => {
  const withArt = exercisesWithArt()
  assert.ok(withArt.length > 0, 'no exercise carries art — did data/exercises.json lose it?')

  const missing = withArt
    .filter((exercise) => {
      try { readFileSync(artDir + exercise.art); return false } catch { return true }
    })
    .map((exercise) => `${exercise.id} -> ${exercise.art}`)
  assert.deepEqual(missing, [], 'these exercises name art that is not on disk')
})

test('art on disk is not orphaned — every file belongs to an exercise', () => {
  // Dead art is not a crash, but it is weight shipped to a phone for nothing.
  const named = new Set(exercisesWithArt().map((exercise) => exercise.art))
  const orphans = readdirSync(artDir)
    .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .filter((file) => !named.has(file))
  assert.deepEqual(orphans, [], 'these art files are in the repo but no exercise uses them')
})

test('every art file is precached, or the gym is offline and the picture is gone', () => {
  const sw = readFileSync(fileURLToPath(new URL('../sw.js', import.meta.url)), 'utf8')
  const missing = exercisesWithArt()
    .map((exercise) => `art/exercises/${exercise.art}`)
    .filter((path) => !sw.includes(`'./${path}'`))
  assert.deepEqual(missing, [], 'add these to PRECACHE in sw.js')
})

test('every art file records where it came from', () => {
  // The images are third-party. Losing the mapping back to the archive entry
  // would leave attribution unverifiable, which is how a licence gets broken.
  const sources = JSON.parse(readFileSync(`${artDir}SOURCES.json`, 'utf8'))
  assert.ok(sources.source?.url, 'SOURCES.json names no source archive')

  const undocumented = exercisesWithArt()
    .filter((exercise) => sources.exercises[exercise.id]?.file !== exercise.art)
    .map((exercise) => exercise.id)
  assert.deepEqual(undocumented, [], 'these have art with no provenance row in SOURCES.json')
})
