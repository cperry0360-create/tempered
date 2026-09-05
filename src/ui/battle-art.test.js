import test from 'node:test'
import assert from 'node:assert/strict'

import { battleArtId, heroSpriteUrl, enemySpriteUrl, itemSpriteUrl } from './battle-art.js'

test('battle art ids accept roster ids and reject path-shaped input', () => {
  assert.equal(battleArtId('cinder_golem'), 'cinder_golem')
  assert.equal(battleArtId('wyrm'), 'wyrm')
  assert.equal(battleArtId('../wyrm'), null)
  assert.equal(battleArtId('Wyrm'), null)
  assert.equal(battleArtId('wyrm.png'), null)
})

test('battle art paths are deterministic and scoped under art/battle', () => {
  assert.match(heroSpriteUrl(), /\/art\/battle\/hero\.png$/)
  assert.match(enemySpriteUrl('slime'), /\/art\/battle\/enemies\/slime\.png$/)
  assert.match(itemSpriteUrl('ember_token'), /\/art\/battle\/items\/ember_token\.png$/)
})

test('invalid ids never produce an art URL', () => {
  assert.equal(enemySpriteUrl('../../index'), null)
  assert.equal(itemSpriteUrl(''), null)
})
