import test from 'node:test'
import assert from 'node:assert/strict'

import { pngDimensions, validateAsset, verifyBattleArt } from './verify-battle-art.js'

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

test('battle art validator reads dimensions from the PNG IHDR header', () => {
  assert.deepEqual(pngDimensions(pngHeader(96, 96)), { width: 96, height: 96 })
  assert.equal(pngDimensions(Buffer.from('not a png')), null)
})

test('battle art validator rejects a wrong canvas size', () => {
  const asset = { width: 96, height: 96 }
  assert.equal(validateAsset(asset, pngHeader(96, 96)).ok, true)
  const wrong = validateAsset(asset, pngHeader(48, 48))
  assert.equal(wrong.ok, false)
  assert.match(wrong.detail, /expected 96×96/)
})

test('incomplete battle art remains a valid fallback state', () => {
  const result = verifyBattleArt({ strict: false, log: () => {} })
  assert.equal(result.ok, true)
  assert.equal(result.failures, 0)
})
