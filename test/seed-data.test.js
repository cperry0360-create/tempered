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
