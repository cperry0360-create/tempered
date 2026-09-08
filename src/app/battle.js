/**
 * The battle service — persistent daily rewards plus an optional run-only
 * Expedition. Real-world activity still owns permanent character progression;
 * Expedition upgrades exist only inside today's play session.
 */

import { generateBattle } from '../domain/battle.js'
import { createTurnBattle, takeTurn, autoTurnBattle, skipTurnBattle } from '../domain/turn-battle.js'
import {
  applyExpeditionUpgrades,
  expeditionChoices,
  splitGauntlet,
} from '../domain/expedition.js'
import { rankFromLevels } from '../domain/rank.js'
import { ATTRIBUTE_IDS } from '../domain/tiers.js'

const EXPEDITION_VERSION = 1
const EXPEDITION_ENCOUNTERS = 3

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

  function groups(record) {
    return splitGauntlet(record.gauntlet ?? [], EXPEDITION_ENCOUNTERS)
  }

  function expeditionFor(record) {
    const count = groups(record).length
    return {
      version: EXPEDITION_VERSION,
      phase: count ? 'battle' : 'complete',
      encounterIndex: 0,
      encounterCount: count,
      upgrades: [],
      choices: [],
    }
  }

  function combatRecord(record, expedition = record.expedition) {
    const encounterIndex = expedition?.encounterIndex ?? 0
    const encounterGroups = groups(record)
    const gauntlet = encounterGroups[encounterIndex] ?? []
    const applied = applyExpeditionUpgrades(record.hero, expedition?.upgrades ?? [])
    return {
      ...record,
      // Give each encounter a deterministic action stream without changing the
      // canonical daily reward seed.
      seed: ((record.seed >>> 0) ^ Math.imul(encounterIndex + 1, 0x45d9f3b)) >>> 0,
      hero: applied.hero,
      gauntlet,
      expeditionModifiers: applied,
    }
  }

  function globalOffset(record, encounterIndex) {
    return groups(record).slice(0, encounterIndex).reduce((sum, group) => sum + group.length, 0)
  }

  function createEncounterState(record, expedition, previousHp = null) {
    const combat = combatRecord(record, expedition)
    const state = createTurnBattle(combat, balance)
    const focusBonus = Math.max(0, Math.round(combat.expeditionModifiers?.focusBonus ?? 0))
    const focusMax = state.focusMax + focusBonus
    const healFraction = combat.expeditionModifiers?.healFraction ?? 0
    const carriedHp = previousHp == null
      ? state.heroMax
      : Math.min(state.heroMax, Math.max(1, previousHp + Math.round(state.heroMax * healFraction)))
    return {
      ...state,
      focus: focusMax,
      focusMax,
      heroHp: carriedHp,
      globalOffset: globalOffset(record, expedition.encounterIndex),
      expeditionEncounter: expedition.encounterIndex,
    }
  }

  function finishEncounter(record, turnState, expedition) {
    if (turnState.status !== 'finished') return { turnState, expedition }
    const hasNext = turnState.won && expedition.encounterIndex + 1 < expedition.encounterCount
    if (hasNext) {
      return {
        turnState,
        expedition: {
          ...expedition,
          phase: 'choice',
          choices: expeditionChoices(record.seed, expedition.encounterIndex, expedition.upgrades),
        },
      }
    }
    return {
      turnState,
      expedition: { ...expedition, phase: 'complete', choices: [] },
    }
  }

  /** Loads or upgrades the persistent Expedition state for the day. */
  async function stateForDate(date) {
    const record = await forDate(date)
    if (record.expedition?.version === EXPEDITION_VERSION && record.turnState?.version === 1) return record

    const expedition = expeditionFor(record)
    const updated = {
      ...record,
      expedition,
      turnState: createEncounterState(record, expedition),
      watched: false,
    }
    await storage.put('battles', updated)
    return updated
  }

  /** Play one manual turn. A won encounter pauses for a 1-of-3 upgrade choice. */
  async function act(action, date) {
    const record = await stateForDate(date)
    if (record.expedition?.phase !== 'battle') return record
    const combat = combatRecord(record)
    const turnState = takeTurn(record.turnState, action, combat, balance)
    const resolved = finishEncounter(record, turnState, record.expedition)
    const updated = {
      ...record,
      ...resolved,
      watched: resolved.expedition.phase === 'complete',
    }
    await storage.put('battles', updated)
    return updated
  }

  /** Take one of the three temporary upgrades and enter the next encounter. */
  async function chooseUpgrade(upgradeId, date) {
    const record = await stateForDate(date)
    const expedition = record.expedition
    if (expedition?.phase !== 'choice') return record
    if (!expedition.choices?.some((choice) => choice.id === upgradeId)) return record

    const nextExpedition = {
      ...expedition,
      phase: 'battle',
      encounterIndex: expedition.encounterIndex + 1,
      upgrades: [...expedition.upgrades, upgradeId],
      choices: [],
    }
    const turnState = createEncounterState(record, nextExpedition, record.turnState.heroHp)
    const updated = { ...record, expedition: nextExpedition, turnState }
    await storage.put('battles', updated)
    return updated
  }

  /**
   * AUTO remains a convenience escape hatch. It resolves combat and chooses the
   * first deterministic offer between encounters until the Expedition is done.
   */
  async function auto(date) {
    let record = await stateForDate(date)
    let safety = 0
    while (record.expedition?.phase !== 'complete' && safety < 12) {
      safety += 1
      if (record.expedition.phase === 'choice') {
        const choice = record.expedition.choices?.[0]
        if (!choice) break
        const nextExpedition = {
          ...record.expedition,
          phase: 'battle',
          encounterIndex: record.expedition.encounterIndex + 1,
          upgrades: [...record.expedition.upgrades, choice.id],
          choices: [],
        }
        record = {
          ...record,
          expedition: nextExpedition,
          turnState: createEncounterState(record, nextExpedition, record.turnState.heroHp),
        }
        continue
      }

      const combat = combatRecord(record)
      const turnState = autoTurnBattle(record.turnState, combat, balance)
      const resolved = finishEncounter(record, turnState, record.expedition)
      record = { ...record, ...resolved }
    }

    const updated = {
      ...record,
      watched: record.expedition?.phase === 'complete',
    }
    await storage.put('battles', updated)
    return updated
  }

  /** Jump to the already-generated canonical daily result. */
  async function skip(date) {
    const record = await stateForDate(date)
    const fullState = createTurnBattle(record, balance)
    const turnState = skipTurnBattle(fullState, record)
    const updated = {
      ...record,
      turnState: { ...turnState, globalOffset: 0, expeditionEncounter: Math.max(0, (record.expedition?.encounterCount ?? 1) - 1) },
      expedition: {
        ...(record.expedition ?? expeditionFor(record)),
        phase: 'complete',
        encounterIndex: Math.max(0, (record.expedition?.encounterCount ?? 1) - 1),
        choices: [],
      },
      watched: true,
    }
    await storage.put('battles', updated)
    return updated
  }

  /** Replay for fun. The daily reward is locked and is never repaid. */
  async function restart(date) {
    const record = await stateForDate(date)
    const expedition = expeditionFor(record)
    const updated = {
      ...record,
      expedition,
      turnState: createEncounterState(record, expedition),
      watched: true,
    }
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

  return {
    forDate, stateForDate, act, chooseUpgrade, auto, skip, restart, markWatched, purse,
  }
}
