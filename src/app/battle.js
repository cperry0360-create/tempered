/**
 * The battle service — the seam between the pure resolver and stored state.
 *
 * One battle exists per day, keyed by date, generated the first time anything
 * asks for it. **Rewards are granted at that moment**, not when the screen is
 * opened: `docs/06` requires that a person who never watches loses nothing but
 * the flavour, and the only way to mean that is for watching to be incapable of
 * changing anything.
 *
 * Re-asking for the same day returns the stored record rather than resolving
 * again. That is belt and braces — the resolver is deterministic, so a second
 * resolution would produce the same battle anyway — but it also means the
 * record is the truth even if the balance file changes underneath it. A battle
 * that was fought on Tuesday should still read the same in Friday's history.
 */

import { generateBattle } from '../domain/battle.js'
import { rankFromLevels } from '../domain/rank.js'
import { ATTRIBUTE_IDS } from '../domain/tiers.js'

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {import('../domain/types.js').Balance} deps.balance
 * @param {object[]} deps.roster
 * @param {object[]} deps.items
 */
export function createBattleService({ storage, clock, balance, roster, items }) {
  async function levelsNow() {
    const rows = await storage.getAll('attributeState')
    /** @type {Record<string, number>} */
    const levels = {}
    for (const id of ATTRIBUTE_IDS) levels[id] = 0
    for (const row of rows) if (row.attribute in levels) levels[row.attribute] = row.level ?? 0
    return levels
  }

  /**
   * Today's battle, generated once and then read back.
   *
   * @param {string} [date]
   * @returns {Promise<object>}
   */
  async function forDate(date) {
    const day = date ?? clock.today()
    const stored = await storage.get('battles', day)
    if (stored) return stored

    const profile = await storage.get('profile', 'profile')
    const levels = await levelsNow()
    const battle = generateBattle({
      profileId: profile?.id ?? 'profile',
      date: day,
      levels,
      roster,
      items,
      balance,
      rank: rankFromLevels(levels, balance),
    })

    const record = { ...battle, watched: false, grantedAt: clock.nowIso() }
    await storage.put('battles', record)
    await grant(record, profile)
    return record
  }

  /**
   * Pays the battle's downstream rewards once.
   *
   * Gold lives on the profile because it is not an attribute and must never be
   * mistaken for one. Loot is flavour/progression for the game layer. Battles
   * deliberately never call the XP engine: character XP must come from real
   * training and lifestyle activity, never from defeating enemies.
   */
  async function grant(record, profile) {
    const gold = (profile?.gold ?? 0) + (record.rewards.gold ?? 0)
    const loot = [...(profile?.loot ?? [])]
    if (record.rewards.item) loot.push({ ...record.rewards.item, wonOn: record.date })
    await storage.put('profile', { ...(profile ?? { id: 'profile' }), id: 'profile', gold, loot })
  }

  /**
   * Notes that the battle has been seen, so Character can show its result
   * rather than its invitation. Deliberately incapable of changing a reward.
   *
   * @param {string} [date]
   */
  async function markWatched(date) {
    const day = date ?? clock.today()
    const stored = await storage.get('battles', day)
    if (!stored || stored.watched) return stored ?? null
    const updated = { ...stored, watched: true }
    await storage.put('battles', updated)
    return updated
  }

  /** Gold and loot, for the Character surface. */
  async function purse() {
    const profile = await storage.get('profile', 'profile')
    return { gold: profile?.gold ?? 0, loot: profile?.loot ?? [] }
  }

  return { forDate, markWatched, purse }
}
