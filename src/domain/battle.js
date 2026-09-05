/**
 * The daily battle — `docs/06-battle.md`.
 *
 * A passive thirty seconds that happens *because* of the week's training. The
 * character is read, never spent: nothing here is separately tracked, and
 * nothing here can be levelled by playing. If this module vanished, the tracker
 * would be unchanged, which is the test non-negotiable 1 sets for the RPG layer.
 *
 * Three properties matter more than the combat does:
 *
 *   - **Deterministic.** Everything random comes from one seeded generator, and
 *     the seed is a pure function of who you are and what day it is. Resolving
 *     the same day twice gives the identical battle down to the last event, so
 *     loot cannot be rerolled by reopening the screen. Anything that rewarded
 *     fiddling with the app instead of training would be the product's own
 *     thesis turned inside out.
 *   - **Rewards belong to the battle, not to watching it.** They are computed
 *     here, at generation. The screen is a replay of a decided thing; skipping
 *     costs nothing because there is nothing left to decide.
 *   - **Items are flavour.** They carry a name and a line of text. `docs/06`:
 *     an item that raised Might would break the entire premise.
 *
 * `docs/06` also says this in as many words: it does not need to be a good
 * combat system, it needs to be a legible thirty seconds. There is no depth
 * here on purpose.
 *
 * Pure, like everything in this directory. No clock, no storage, no DOM.
 */

/**
 * A 32-bit seed from profile and date.
 *
 * FNV-1a, which is short enough to read and stable enough to trust — the point
 * is not cryptographic strength, it is that the same inputs give the same
 * number on every device and every build, forever.
 *
 * @param {string} profileId
 * @param {string} date  ISO day
 * @returns {number} unsigned 32-bit
 */
export function battleSeed(profileId, date) {
  const text = `${profileId ?? ''}:${date ?? ''}`
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * A small deterministic generator. Mulberry32: one line of state, uniform
 * enough for loot, and identical everywhere.
 *
 * @param {number} seed
 * @returns {() => number} successive values in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The hero, read off the character sheet.
 *
 * @param {Record<string, number>} levels  attribute levels
 * @param {import('./types.js').Balance} balance
 */
export function heroFor(levels, balance) {
  const b = balance.battle
  const at = (id) => Math.max(0, levels?.[id] ?? 0)
  return {
    health: b.healthBase + at('vitality') * b.healthFromVitality + at('grit') * b.healthFromGrit,
    damage: b.damageBase + at('might') * b.damageFromMight,
    attackSpeed: b.attackSpeedBase + at('wind') * b.attackSpeedFromWind,
    // A probability, not a percentage, and capped: certainty would remove the
    // only thing that makes two days of the same gauntlet read differently.
    crit: Math.min(b.critCap, (at('mind') * b.critFromMind) / 100),
    defence: at('grit') * b.defenceFromGrit,
  }
}

/** Rank letters, weakest first. Used only to scale the gauntlet. */
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S']

/**
 * Six or so enemies scaled to rank, ending in one tougher.
 *
 * The roster is drawn from by tier so a rank F character meets slimes and a
 * rank S character meets wyrms, and every enemy is then scaled by rank so the
 * gauntlet keeps pace with a character who outgrows the roster's top tier.
 *
 * @param {number} seed
 * @param {string} rank
 * @param {{id: string, name: string, tier: number, hp: number, damage: number, speed: number, boss?: boolean}[]} roster
 * @param {import('./types.js').Balance} balance
 */
export function gauntletFor(seed, rank, roster, balance) {
  const b = balance.battle
  const rng = createRng(seed ^ 0x9e3779b9)
  const step = Math.max(0, RANKS.indexOf(rank))
  const scale = 1 + step * b.rankScaling

  const tiers = [...new Set(roster.map((e) => e.tier))].sort((a, b2) => a - b2)
  // The band of tiers this rank fights. It climbs with rank and keeps the lower
  // tiers in reach, so an early enemy is still an early enemy at rank S.
  //
  // The tier IS most of the difficulty curve — enemies.json says so — and the
  // first version added a tier on top of that, which put a brand-new character
  // against orcs and produced a 0% clear rate from rank D upward. `rankScaling`
  // is the fine adjustment between tiers, not a second curve.
  const top = tiers[Math.min(tiers.length - 1, Math.round(step * (tiers.length - 1) / (RANKS.length - 1)))]
  const pool = roster.filter((e) => e.tier <= top && !e.boss)
  const bosses = roster.filter((e) => e.boss && e.tier <= top + 1)

  const shape = (enemy, multiplier) => ({
    id: enemy.id,
    name: enemy.name,
    boss: enemy.boss === true,
    hp: Math.max(1, Math.round(enemy.hp * scale * multiplier)),
    damage: Math.max(1, Math.round(enemy.damage * scale * multiplier)),
    speed: enemy.speed,
  })

  const count = Math.max(1, b.enemiesPerGauntlet)
  const gauntlet = []
  for (let i = 0; i < count - 1; i += 1) {
    const pick = (pool.length > 0 ? pool : roster)[Math.floor(rng() * (pool.length || roster.length))]
    gauntlet.push(shape(pick, 1))
  }

  // The last one is the tougher enemy docs/06 asks for: a boss where the roster
  // has one in reach, otherwise the hardest thing available, and either way
  // multiplied so it always ends harder than what came before.
  const finalPool = bosses.length > 0 ? bosses : (pool.length > 0 ? pool : roster)
  const last = finalPool[Math.floor(rng() * finalPool.length)]
  const hardest = Math.max(0, ...gauntlet.map((e) => e.hp))
  let boss = shape(last, b.bossMultiplier)
  if (boss.hp <= hardest) boss = { ...boss, hp: hardest + 1 }
  gauntlet.push(boss)

  return gauntlet
}

/**
 * Fits a gauntlet to the character it is about to meet.
 *
 * `docs/06` asks for roughly an 80% clear rate **at every rank**, which is a
 * request for difficulty that tracks the character rather than one that outruns
 * them. Rank alone could not deliver it: rank is a seven-step function of
 * levels and the roster's tiers are a five-step function of rank, so two coarse
 * staircases against smooth growth gave 100% at one rank and 0% at the next.
 *
 * So tier still chooses *who* you fight — slimes at F, wyrms at S, which is the
 * visible reward for a year of training — and this chooses *how hard they hit*.
 * It searches for the multiplier at which the day's matchup is survived about
 * `clearRateTarget` of the time, sampling sibling seeds of the same day to
 * estimate that. The battle actually played is then one honest draw from the
 * distribution measured here, which is why some days are lost.
 *
 * Fitting against the clear rate directly, rather than against a health margin,
 * is what made the number stable: a margin had to be translated into a win rate
 * through the combat loop, and that translation was wildly non-linear — 45% at
 * one level and 97% at the next from the same setting.
 *
 * Deterministic throughout: a bisection over a pure function of the same inputs.
 *
 * @returns {number} the multiplier to apply to every enemy
 */
function fitToHero(seed, hero, gauntlet, balance) {
  const b = balance.battle
  const samples = Math.max(3, b.fitSamples)

  /** The share of sampled runs this multiplier would be survived. */
  const winRateAt = (multiplier) => {
    const scaled = gauntlet.map((enemy) => ({
      ...enemy,
      hp: Math.max(1, Math.round(enemy.hp * multiplier)),
      damage: Math.max(1, Math.round(enemy.damage * multiplier)),
    }))
    let won = 0
    for (let i = 0; i < samples; i += 1) {
      // Sibling seeds of the same day, so the estimate is deterministic and the
      // real battle below is one honest draw from the distribution measured here.
      const probe = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0
      if (resolveBattle({ seed: probe, hero, gauntlet: scaled, balance }).won) won += 1
    }
    return won / samples
  }

  // Harder enemies mean fewer wins, so the win rate falls as the multiplier
  // rises: a plain bisection finds where it crosses the target.
  let low = 0.05
  let high = 40
  for (let i = 0; i < b.fitSteps; i += 1) {
    const mid = (low + high) / 2
    if (winRateAt(mid) >= b.clearRateTarget) low = mid
    else high = mid
  }
  return Math.max(0.05, low)
}

/**
 * Resolves the gauntlet: a deterministic exchange, one enemy at a time.
 *
 * Both sides carry a cooldown from their attack speed; whoever's next swing
 * lands soonest goes next. Ties go to the hero, which is arbitrary and has to
 * be decided somewhere — leaving it to floating-point order would be exactly
 * the kind of thing that resolves differently on another engine.
 *
 * @returns {{events: object[], won: boolean, defeated: number, duration: number, remainingHealth: number}}
 */
export function resolveBattle({ seed, hero, gauntlet, balance }) {
  const rng = createRng(seed)
  /**
   * Every blow lands a little harder or softer than the last.
   *
   * Without this the only variance in the whole battle is the crit roll, and
   * crit comes from Mind — so a new character with Mind 0 had no variance at
   * all and every day resolved identically. Two days that look the same are not
   * a battle, they are a screensaver.
   */
  const variance = balance.battle.damageVariance ?? 0
  const vary = (damage) => Math.max(1, Math.round(damage * (1 + (rng() * 2 - 1) * variance)))

  /** @type {object[]} */
  const events = []
  let health = hero.health
  let at = 0
  let defeated = 0

  // A hard ceiling so a hopeless matchup cannot spin. It is generous enough that
  // no realistic battle reaches it, and it ends the fight rather than the app.
  const MAX_EXCHANGES = 4000
  let exchanges = 0

  for (const [index, template] of gauntlet.entries()) {
    const enemy = { ...template }
    events.push({ at: round(at), kind: 'enemy', index, id: enemy.id, name: enemy.name, hp: enemy.hp, boss: enemy.boss })

    let heroNext = at + 1 / hero.attackSpeed
    let enemyNext = at + 1 / Math.max(0.05, enemy.speed)

    while (enemy.hp > 0 && health > 0 && exchanges < MAX_EXCHANGES) {
      exchanges += 1
      if (heroNext <= enemyNext) {
        at = heroNext
        const crit = rng() < hero.crit
        const damage = vary(hero.damage * (crit ? 2 : 1))
        enemy.hp -= damage
        events.push({ at: round(at), kind: 'hit', by: 'hero', target: enemy.id, damage, crit, enemyHp: Math.max(0, enemy.hp) })
        heroNext += 1 / hero.attackSpeed
      } else {
        at = enemyNext
        // Defence subtracts, and never to nothing: an unkillable hero is not a
        // battle, and a floor of 1 keeps the gauntlet honest at every rank.
        const damage = vary(Math.max(1, enemy.damage - hero.defence))
        health -= damage
        events.push({ at: round(at), kind: 'hit', by: 'enemy', target: 'hero', damage, crit: false, heroHp: Math.max(0, health) })
        enemyNext += 1 / Math.max(0.05, enemy.speed)
      }
    }

    if (enemy.hp <= 0) {
      defeated += 1
      events.push({ at: round(at), kind: 'defeated', index, id: enemy.id, name: enemy.name })
    }
    if (health <= 0) {
      events.push({ at: round(at), kind: 'down', index, id: enemy.id, name: enemy.name })
      break
    }
    if (exchanges >= MAX_EXCHANGES) break
  }

  const won = defeated === gauntlet.length && health > 0
  events.push({ at: round(at), kind: won ? 'won' : 'ended', defeated, of: gauntlet.length })

  return { events, won, defeated, duration: round(at), remainingHealth: Math.max(0, Math.round(health)) }
}

/** Times are rounded so an event log is stable across engines and readable. */
const round = (n) => Math.round(n * 1000) / 1000

/**
 * Today's battle, whole: seed, hero, gauntlet, resolution and rewards.
 *
 * Rewards are computed here because `docs/06` requires that they are granted on
 * generation rather than on watching. There is deliberately no "watched" input
 * to this function — there is nothing it could change.
 *
 * @param {object} input
 * @param {string} input.profileId
 * @param {string} input.date
 * @param {Record<string, number>} input.levels
 * @param {object[]} input.roster
 * @param {{id: string, name: string, flavour?: string}[]} input.items
 * @param {import('./types.js').Balance} input.balance
 * @param {string} [input.rank]
 */
export function generateBattle({ profileId, date, levels, roster, items, balance, rank = 'F' }) {
  const b = balance.battle
  const seed = battleSeed(profileId, date)
  const hero = heroFor(levels, balance)
  const raw = gauntletFor(seed, rank, roster, balance)
  const fit = fitToHero(seed, hero, raw, balance)
  const gauntlet = raw.map((enemy) => ({
    ...enemy,
    hp: Math.max(1, Math.round(enemy.hp * fit)),
    damage: Math.max(1, Math.round(enemy.damage * fit)),
  }))
  const outcome = resolveBattle({ seed, hero, gauntlet, balance })

  // A separate stream for loot, so changing the combat loop cannot silently
  // change what dropped on a day that has already happened.
  const lootRng = createRng(seed ^ 0x85ebca6b)
  const drops = lootRng() < b.itemDropChance && outcome.defeated > 0
  const item = drops && items.length > 0
    ? { ...items[Math.floor(lootRng() * items.length)] }
    : null

  return {
    date,
    seed,
    rank,
    hero,
    gauntlet,
    ...outcome,
    rewards: {
      // Paid per enemy that fell, so a loss still pays for the work done. No
      // punishment: a defeat is a smaller reward, never a debt.
      gold: Math.max(0, outcome.defeated * b.goldPerEnemy),
      // Zero as shipped. See DECISIONS.md — the mechanism is here so the
      // decision stays a config change rather than a code change.
      xp: Math.max(0, outcome.defeated * (b.xpPerEnemy ?? 0)),
      xpAttribute: b.xpAttribute ?? 'grit',
      item,
    },
  }
}
