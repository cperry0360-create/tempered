import { createRng } from './battle.js'

export const EXPEDITION_UPGRADES = Object.freeze([
  Object.freeze({ id: 'tempered_edge', name: 'Tempered Edge', description: '+18% attack damage', damage: 0.18 }),
  Object.freeze({ id: 'iron_skin', name: 'Iron Skin', description: '+18% max health and +2 defence', health: 0.18, defence: 2 }),
  Object.freeze({ id: 'quickstep', name: 'Quickstep', description: '+18% speed for more dodges', speed: 0.18 }),
  Object.freeze({ id: 'keen_eye', name: 'Keen Eye', description: '+8% critical chance', crit: 0.08 }),
  Object.freeze({ id: 'deep_focus', name: 'Deep Focus', description: '+2 Focus each encounter', focus: 2 }),
  Object.freeze({ id: 'field_rations', name: 'Field Rations', description: 'Recover 25% max health between encounters', heal: 0.25 }),
])

const byId = new Map(EXPEDITION_UPGRADES.map((upgrade) => [upgrade.id, upgrade]))

/** Three deterministic offers. Same day + same encounter always produces the same choices. */
export function expeditionChoices(seed, encounterIndex, owned = []) {
  const ownedSet = new Set(owned)
  const available = EXPEDITION_UPGRADES.filter((upgrade) => !ownedSet.has(upgrade.id))
  const pool = available.length >= 3 ? available : EXPEDITION_UPGRADES
  const rng = createRng(((seed >>> 0) ^ Math.imul(encounterIndex + 1, 0x6d2b79f5)) >>> 0)
  const copy = [...pool]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy.slice(0, 3)
}

/** Apply temporary run-only upgrades to the generated hero. */
export function applyExpeditionUpgrades(hero, upgradeIds = []) {
  let damageMultiplier = 1
  let healthMultiplier = 1
  let speedMultiplier = 1
  let defenceBonus = 0
  let critBonus = 0
  let focusBonus = 0
  let healFraction = 0

  for (const id of upgradeIds) {
    const upgrade = byId.get(id)
    if (!upgrade) continue
    damageMultiplier += upgrade.damage ?? 0
    healthMultiplier += upgrade.health ?? 0
    speedMultiplier += upgrade.speed ?? 0
    defenceBonus += upgrade.defence ?? 0
    critBonus += upgrade.crit ?? 0
    focusBonus += upgrade.focus ?? 0
    healFraction += upgrade.heal ?? 0
  }

  return {
    hero: {
      ...hero,
      damage: Math.max(1, Math.round(hero.damage * damageMultiplier)),
      health: Math.max(1, Math.round(hero.health * healthMultiplier)),
      defence: Math.max(0, Math.round((hero.defence ?? 0) + defenceBonus)),
      attackSpeed: Math.max(0.1, hero.attackSpeed * speedMultiplier),
      crit: Math.max(0, Math.min(0.75, hero.crit + critBonus)),
    },
    focusBonus,
    healFraction: Math.min(0.75, healFraction),
  }
}

export function expeditionUpgrade(id) {
  return byId.get(id) ?? null
}

export function splitGauntlet(gauntlet = [], encounterCount = 3) {
  const count = Math.max(1, Math.min(encounterCount, gauntlet.length || 1))
  const result = []
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor((index * gauntlet.length) / count)
    const end = Math.floor(((index + 1) * gauntlet.length) / count)
    result.push(gauntlet.slice(start, Math.max(start + 1, end)))
  }
  return result.filter((group) => group.length > 0)
}
