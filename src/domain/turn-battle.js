/**
 * Tiny optional turn-based layer for the daily battle.
 *
 * The daily encounter and its rewards are still generated once from the day
 * seed. These functions only decide how that encounter plays on screen. They
 * cannot award XP, gold, loot, or change any tracker state.
 */

import { createRng } from './battle.js'

const ACTION_CODES = Object.freeze({ attack: 0x51ed270b, guard: 0x68bc21eb, skill: 0x02e5be93 })

/** @param {number} value @param {number} min @param {number} max */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/** @param {number} damage @param {() => number} rng @param {number} variance */
function variedDamage(damage, rng, variance) {
  return Math.max(1, Math.round(damage * (1 + (rng() * 2 - 1) * variance)))
}

/**
 * @param {object} record generated daily battle record
 * @param {import('./types.js').Balance} balance
 */
export function createTurnBattle(record, balance) {
  const first = record.gauntlet?.[0] ?? null
  const focusMax = Math.max(0, Math.round(balance.battle.turnFocus ?? 3))
  return {
    version: 1,
    status: first ? 'active' : 'finished',
    turn: 0,
    heroHp: record.hero.health,
    heroMax: record.hero.health,
    focus: focusMax,
    focusMax,
    enemyIndex: 0,
    enemyHp: first?.hp ?? 0,
    enemyMax: first?.hp ?? 0,
    defeated: 0,
    won: !first,
    log: first ? [{ kind: 'enemy', name: first.name, boss: first.boss === true }] : [],
  }
}

/** @param {object} state @param {object} record */
export function currentEnemy(state, record) {
  return record.gauntlet?.[state.enemyIndex] ?? null
}

/**
 * One deterministic player turn followed by at most one enemy response.
 * Replaying the same actions on the same daily seed gives the same result.
 *
 * ATTACK: normal hit.
 * GUARD: reduce this enemy response and recover one Focus.
 * SKILL: stronger hit for one Focus.
 *
 * @param {object} state
 * @param {'attack'|'guard'|'skill'} action
 * @param {object} record
 * @param {import('./types.js').Balance} balance
 */
export function takeTurn(state, action, record, balance) {
  if (state.status === 'finished') return state
  if (!ACTION_CODES[action]) throw new RangeError(`Unknown battle action: ${action}`)
  if (action === 'skill' && state.focus <= 0) return state

  const enemy = currentEnemy(state, record)
  if (!enemy) return { ...state, status: 'finished', won: true }

  const b = balance.battle
  const variance = b.damageVariance ?? 0
  const actionSeed = (record.seed ^ Math.imul(state.turn + 1, ACTION_CODES[action])) >>> 0
  const rng = createRng(actionSeed)
  const log = [...state.log]
  let heroHp = state.heroHp
  let enemyHp = state.enemyHp
  let focus = state.focus
  let defeated = state.defeated
  let enemyIndex = state.enemyIndex
  let enemyMax = state.enemyMax
  let won = false
  let status = 'active'

  if (action === 'guard') {
    focus = Math.min(state.focusMax, focus + Math.max(0, Math.round(b.turnGuardFocusGain ?? 1)))
    log.push({ kind: 'guard', by: 'hero' })
  } else {
    const crit = rng() < record.hero.crit
    const multiplier = action === 'skill' ? (b.turnSkillDamageMultiplier ?? 1.75) : 1
    if (action === 'skill') focus -= 1
    const damage = variedDamage(record.hero.damage * multiplier * (crit ? 2 : 1), rng, variance)
    enemyHp = Math.max(0, enemyHp - damage)
    log.push({ kind: action, by: 'hero', damage, crit, enemyHp })
  }

  if (enemyHp <= 0) {
    defeated += 1
    log.push({ kind: 'defeated', name: enemy.name, id: enemy.id })
    if (defeated >= record.gauntlet.length) {
      status = 'finished'
      won = true
      log.push({ kind: 'won' })
    } else {
      enemyIndex += 1
      const next = record.gauntlet[enemyIndex]
      enemyHp = next.hp
      enemyMax = next.hp
      log.push({ kind: 'enemy', name: next.name, boss: next.boss === true })
    }
  } else {
    const speedGain = Math.max(0, record.hero.attackSpeed - (b.attackSpeedBase ?? 1))
    const dodgeChance = clamp(speedGain * (b.turnDodgeFromSpeed ?? 0.45), 0, b.turnDodgeCap ?? 0.35)
    const dodged = rng() < dodgeChance
    if (dodged) {
      log.push({ kind: 'dodge', by: 'hero' })
    } else {
      const guarded = action === 'guard'
      const guardMultiplier = guarded ? (b.turnGuardDamageMultiplier ?? 0.35) : 1
      const raw = Math.max(1, enemy.damage - record.hero.defence) * guardMultiplier
      const damage = variedDamage(raw, rng, variance)
      heroHp = Math.max(0, heroHp - damage)
      log.push({ kind: 'enemyHit', by: 'enemy', damage, heroHp, guarded })
      if (heroHp <= 0) {
        status = 'finished'
        won = false
        log.push({ kind: 'down', name: enemy.name })
      }
    }
  }

  const maxLog = Math.max(4, Math.round(b.turnLogLimit ?? 8))
  return {
    ...state,
    status,
    turn: state.turn + 1,
    heroHp,
    focus,
    enemyIndex,
    enemyHp,
    enemyMax,
    defeated,
    won,
    log: log.slice(-maxLog),
  }
}

/**
 * Simple deterministic AI for AUTO. It spends Focus on bosses or every third
 * turn and guards when hurt; otherwise it attacks.
 */
export function autoTurnBattle(state, record, balance) {
  let next = state
  const maxTurns = Math.max(20, Math.round(balance.battle.turnMaxTurns ?? 250))
  while (next.status !== 'finished' && next.turn < maxTurns) {
    const enemy = currentEnemy(next, record)
    const hurt = next.heroHp / Math.max(1, next.heroMax) <= (balance.battle.turnAutoGuardBelow ?? 0.28)
    let action = 'attack'
    if (next.focus > 0 && (enemy?.boss || next.turn % 3 === 2)) action = 'skill'
    else if (hurt && next.turn % 2 === 1) action = 'guard'
    next = takeTurn(next, action, record, balance)
  }
  return next
}

/**
 * SKIP uses the already-generated canonical daily result. It never rerolls the
 * day and it never changes rewards.
 */
export function skipTurnBattle(state, record) {
  const finalEnemyIndex = Math.max(0, Math.min(record.gauntlet.length - 1, record.defeated))
  const finalEnemy = record.gauntlet[finalEnemyIndex] ?? null
  return {
    ...state,
    status: 'finished',
    turn: Math.max(state.turn, 1),
    heroHp: record.remainingHealth,
    enemyIndex: finalEnemyIndex,
    enemyHp: record.won ? 0 : (finalEnemy?.hp ?? 0),
    enemyMax: finalEnemy?.hp ?? 0,
    defeated: record.defeated,
    won: record.won,
    log: [{ kind: 'skipped', won: record.won, defeated: record.defeated }],
  }
}
