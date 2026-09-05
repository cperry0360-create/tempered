import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const index = read('index.html')

test('REGRESSION: installed app locks visual viewport against pinch zoom drift', () => {
  assert.match(index, /name="viewport"[^>]*maximum-scale=1[^>]*user-scalable=no/)
  assert.match(index, /touch-action:\s*pan-x pan-y/)
})

test('REGRESSION: content starts with a deliberate 32px gap below the safe area', () => {
  assert.match(index, /padding-top:\s*calc\(max\(var\(--s4\), env\(safe-area-inset-top\)\) \+ var\(--s5\)\)/)
})
