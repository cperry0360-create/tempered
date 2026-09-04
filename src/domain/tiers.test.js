import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { TIER_NAMES, ATTRIBUTE_IDS, tierName } from './tiers.js'

const balance = loadBalance()

test('every attribute has a name for level 0 through maxLevel', () => {
  for (const attribute of ATTRIBUTE_IDS) {
    assert.equal(TIER_NAMES[attribute].length, balance.levelCurve.maxLevel + 1)
  }
})

test('tier names match the table in docs/01', () => {
  assert.equal(tierName('might', 0), 'Untrained')
  assert.equal(tierName('might', 5), 'Formidable')
  assert.equal(tierName('might', 10), 'Mythic')
  assert.equal(tierName('grit', 6), 'Ironclad')
  assert.equal(tierName('vitality', 0), 'Depleted')
  assert.equal(tierName('mind', 10), 'Transcendent')
  assert.equal(tierName('wind', 1), 'Winded')
})

test('tierName clamps rather than throwing on an out-of-range level', () => {
  assert.equal(tierName('might', -3), 'Untrained')
  assert.equal(tierName('might', 99), 'Mythic')
})
