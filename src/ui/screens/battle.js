/**
 * BATTLE — the daily thirty seconds. `docs/06-battle.md`, Phase 6.
 *
 * The one place in the app where theatricality is allowed, and it must not leak
 * anywhere else: the tracker stays quiet. What theatre there is here comes from
 * motion, colour and the battle sprites. The screen keeps the existing glyphs
 * as a deliberate fallback until each canonical PNG exists.
 *
 * Nothing here decides anything. The battle was resolved and paid for the
 * moment it was generated; this is a replay of a settled thing, which is
 * precisely why skipping it can cost nothing. PAUSE, 1x and SKIP are the whole
 * control surface, per the spec, and SKIP is never discouraged.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { heroSpriteUrl, enemySpriteUrl, itemSpriteUrl } from '../battle-art.js'

/** Playback is compressed so a long gauntlet still reads in about half a minute. */
const TARGET_SECONDS = 26

/**
 * A sprite with a built-in Tempered glyph fallback. The fallback is visible
 * first, so a missing or slow image never produces a broken-image flash.
 * @param {object} options
 * @param {string|null} options.src
 * @param {string} options.alt
 * @param {string} options.glyph
 * @param {string} options.attribute
 */
function fighterVisual({ src, alt, glyph, attribute }) {
  const visual = el('span.fighter__visual', { dataset: { ready: 'false' } })
  const fallback = el('span.fighter__mark', { dataset: { attribute } }, [icon(glyph)])
  const image = src && el('img.fighter__sprite', {
    src,
    alt,
    draggable: false,
    onload: () => { visual.dataset.ready = 'true' },
    onerror: () => { visual.dataset.ready = 'false'; image.remove() },
  })
  visual.append(fallback)
  if (image) visual.append(image)
  return visual
}

/** The same fallback rule for cosmetic loot icons. */
function itemVisual(item) {
  const visual = el('span.reward__item-visual', { dataset: { ready: 'false' } })
  const fallback = el('span.reward__item-fallback', {}, [icon('item')])
  const src = itemSpriteUrl(item?.id)
  const image = src && el('img.reward__item-icon', {
    src,
    alt: '',
    draggable: false,
    onload: () => { visual.dataset.ready = 'true' },
    onerror: () => { visual.dataset.ready = 'false'; image.remove() },
  })
  visual.append(fallback)
  if (image) visual.append(image)
  return visual
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/battle.js').createBattleService>} deps.battle
 * @param {() => void} deps.onClose
 */
export function createBattleScreen({ battle, onClose }) {
  const root = el('div.screen.screen--battle')

  /** @type {any} */ let record = null
  /** @type {number} */ let cursor = 0
  let playing = false
  let finished = false
  /** @type {number|null} */ let timer = null
  /** How much of the log has been shown, in the battle's own seconds. */
  let clockAt = 0

  /** The state the log has reached: whose turn it is and how battered. */
  function stateAt(index) {
    const hero = { hp: record.hero.health, max: record.hero.health }
    let enemy = null
    let defeated = 0
    for (const event of record.events.slice(0, index)) {
      if (event.kind === 'enemy') enemy = { ...event, max: event.hp }
      if (event.kind === 'hit' && event.by === 'hero' && enemy) enemy.hp = event.enemyHp
      if (event.kind === 'hit' && event.by === 'enemy') hero.hp = event.heroHp
      if (event.kind === 'defeated') defeated += 1
    }
    return { hero, enemy, defeated }
  }

  function stop() {
    if (timer !== null) clearInterval(timer)
    timer = null
    playing = false
  }

  function play() {
    if (finished) return
    playing = true
    if (timer !== null) clearInterval(timer)
    const total = Math.max(0.001, record.duration)
    const perTick = total / (TARGET_SECONDS * 20)
    timer = setInterval(() => {
      clockAt += perTick
      let moved = false
      while (cursor < record.events.length && record.events[cursor].at <= clockAt) {
        cursor += 1
        moved = true
      }
      if (cursor >= record.events.length) { finish(); return }
      if (moved) render()
    }, 50)
    render()
  }

  function finish() {
    stop()
    cursor = record.events.length
    finished = true
    battle.markWatched(record.date).catch(() => {})
    render()
  }

  /** The bar under a combatant. Never red: a hurt hero is not a failure state. */
  function meter(value, max, who) {
    const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)))
    return el('span.meter', { dataset: { who } }, [
      el('span.meter__fill', { style: `width:${pct}%` }),
    ])
  }

  function combatants() {
    const { hero, enemy, defeated } = stateAt(cursor)
    return el('div.fight', {}, [
      el('div.fighter', { dataset: { side: 'hero', boss: 'false' } }, [
        fighterVisual({
          src: heroSpriteUrl(), alt: 'Tempered hero', glyph: 'train', attribute: 'might',
        }),
        el('span.fighter__name', { text: 'You' }),
        meter(hero.hp, hero.max, 'hero'),
        el('span.fighter__hp', { text: `${Math.max(0, hero.hp)}` }),
      ]),
      el('div.fight__vs', { text: `${defeated} of ${record.gauntlet.length}` }),
      el('div.fighter', { dataset: { side: 'enemy', boss: String(enemy?.boss === true) } }, [
        fighterVisual({
          src: enemySpriteUrl(enemy?.id),
          alt: enemy?.name ?? 'Enemy',
          glyph: 'foe',
          attribute: enemy?.boss ? 'vitality' : 'mind',
        }),
        el('span.fighter__name', { text: enemy?.name ?? '—' }),
        meter(enemy?.hp ?? 0, enemy?.max ?? 1, 'enemy'),
        el('span.fighter__hp', { text: enemy ? `${Math.max(0, enemy.hp)}` : '' }),
      ]),
    ])
  }

  /** The last few events, newest first — the floating damage, as a log. */
  function feed() {
    const recent = record.events.slice(Math.max(0, cursor - 5), cursor).reverse()
    return el('ol.feed', {}, recent.map((event) => {
      if (event.kind === 'hit') {
        // The event carries the enemy's id; a person reads its name.
        const named = record.gauntlet.find((e) => e.id === event.target)?.name ?? event.target
        return el('li.feed__line', { dataset: { by: event.by, crit: String(event.crit === true) } }, [
          el('span.feed__what', { text: event.by === 'hero' ? `You hit the ${named}` : 'You are hit' }),
          el('span.feed__dmg', { text: `−${event.damage}${event.crit ? ' crit' : ''}` }),
        ])
      }
      const said = {
        enemy: `${event.name} steps up`,
        defeated: `${event.name} falls`,
        down: 'You go down',
        won: 'The gauntlet is cleared',
        ended: 'The gauntlet ends',
      }[event.kind]
      return el('li.feed__line', { dataset: { by: 'note' } }, [el('span.feed__what', { text: said ?? event.kind })])
    }))
  }

  function result() {
    const { rewards } = record
    return el('section.card.outcome', { dataset: { won: String(record.won) } }, [
      el('h2.block__title', { text: record.won ? 'Gauntlet cleared' : 'The gauntlet held' }),
      el('p.outcome__line', {
        text: record.won
          ? `All ${record.gauntlet.length} down, with ${record.remainingHealth} health to spare.`
          : `${record.defeated} of ${record.gauntlet.length} down. Tomorrow brings another.`,
      }),
      el('div.outcome__rewards', {}, [
        el('span.reward', { dataset: { kind: 'gold' } }, [
          el('span.reward__value', { dataset: { acid: 'value' }, text: String(rewards.gold) }),
          el('span.reward__label', { text: 'GOLD' }),
        ]),
        rewards.item && el('span.reward', { dataset: { kind: 'item' } }, [
          itemVisual(rewards.item),
          el('span.reward__value', { text: rewards.item.name }),
          el('span.reward__label', { text: 'FOUND' }),
        ]),
      ]),
      rewards.item?.flavour && el('p.outcome__flavour', { text: rewards.item.flavour }),
    ])
  }

  function render() {
    if (!record) {
      replace(root, [el('h1.screen__title', { text: 'Battle' }),
        el('p.block__hint', { text: 'Reading today’s battle…' })])
      return
    }

    replace(root, [
      el('div.battle__head', {}, [
        el('h1.screen__title', { text: 'Battle' }),
        el('span.battle__rank', { text: `RANK ${record.rank}` }),
      ]),

      combatants(),
      feed(),

      finished && result(),

      el('div.battle__controls', {}, [
        !finished && el('button.button', {
          type: 'button', dataset: { battle: playing ? 'pause' : 'play' },
          onclick: () => { playing ? stop() : play(); render() },
        }, [icon(playing ? 'minus' : 'play'), playing ? 'PAUSE' : '1×']),

        // Always available, never discouraged, and it does not cost a thing —
        // the rewards were paid when the battle was made.
        !finished && el('button.button', {
          type: 'button', dataset: { battle: 'skip' },
          onclick: () => finish(),
        }, ['SKIP TO RESULT']),

        finished && el('button.button', {
          type: 'button', dataset: { battle: 'rewatch' },
          onclick: () => { cursor = 0; clockAt = 0; finished = false; play() },
        }, [icon('history'), 'WATCH AGAIN']),

        // The battle screen's single primary action, so it carries the acid.
        el('button.button', {
          type: 'button', dataset: { battle: 'close', acid: 'primary' },
          onclick: () => { stop(); onClose() },
        }, ['DONE']),
      ]),

      el('p.block__hint', {
        text: 'Fought once a day from what you have trained. Watching is optional — the result and its rewards are already yours.',
      }),
    ])
  }

  return {
    root,

    async start() {
      stop()
      record = await battle.forDate()
      cursor = 0
      clockAt = 0
      finished = false
      render()
      play()
    },

    destroy() { stop() },
  }
}
