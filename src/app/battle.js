/**
 * The battle service — the seam between the pure resolver and stored state.
 *
 * One battle exists per day, keyed by date, generated the first time anything
 * asks for it. Rewards are granted at that moment. The optional turn-based
 * controls change only how the encounter is played on screen; they cannot
 * change tracker XP, reroll loot, or pay the day twice.
 */

import { generateBattle } from '../domain/battle.js'
import { createTurnBattle, takeTurn, autoTurnBattle, skipTurnBattle } from '../domain/turn-battle.js'
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

  /** Today's generated battle, created once and then read back. */
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

  /** Pays the fixed daily gold/loot once. Character XP is never touched here. */
  async function grant(record, profile) {
    const gold = (profile?.gold ?? 0) + (record.rewards.gold ?? 0)
    const loot = [...(profile?.loot ?? [])]
    if (record.rewards.item) loot.push({ ...record.rewards.item, wonOn: record.date })
    await storage.put('profile', { ...(profile ?? { id: 'profile' }), id: 'profile', gold, loot })
  }

  /**
   * Loads or lazily creates the persistent turn state for the day. This also
   * upgrades an already-generated passive battle without rerolling it.
   */
  async function stateForDate(date) {
    const record = await forDate(date)
    if (record.turnState?.version === 1) return record
    const updated = { ...record, turnState: createTurnBattle(record, balance) }
    await storage.put('battles', updated)
    return updated
  }

  /** Play one manual turn and persist it immediately. */
  async function act(action, date) {
    const record = await stateForDate(date)
    const turnState = takeTurn(record.turnState, action, record, balance)
    const updated = {
      ...record,
      turnState,
      watched: record.watched || turnState.status === 'finished',
    }
    await storage.put('battles', updated)
    return updated
  }

  /** Let the tiny deterministic AI finish from the current state. */
  async function auto(date) {
    const record = await stateForDate(date)
    const turnState = autoTurnBattle(record.turnState, record, balance)
    const updated = { ...record, turnState, watched: true }
    await storage.put('battles', updated)
    return updated
  }

  /** Jump to the already-generated canonical daily result. */
  async function skip(date) {
    const record = await stateForDate(date)
    const turnState = skipTurnBattle(record.turnState, record)
    const updated = { ...record, turnState, watched: true }
    await storage.put('battles', updated)
    return updated
  }

  /** Replay for fun. The daily reward is already locked and is never repaid. */
  async function restart(date) {
    const record = await stateForDate(date)
    const updated = { ...record, turnState: createTurnBattle(record, balance), watched: true }
    await storage.put('battles', updated)
    return updated
  }

  /** Compatibility marker for existing callers/history. Never changes rewards. */
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

  return { forDate, stateForDate, act, auto, skip, restart, markWatched, purse }
}
