/**
 * BATTLE — a tiny optional turn-based daily encounter.
 *
 * The tracker remains the product. Battle choices only change the on-screen
 * encounter. Daily rewards are generated once from the day seed, character XP
 * is never granted here, and AUTO / SKIP are always available.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { heroSpriteUrl, enemySpriteUrl, itemSpriteUrl } from '../battle-art.js'

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
  let busy = false

  const state = () => record?.turnState ?? null
  const enemy = () => {
    const current = state()
    return current ? record.gauntlet?.[current.enemyIndex] ?? null : null
  }

  function meter(value, max, who) {
    const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)))
    return el('span.meter', { dataset: { who } }, [
      el('span.meter__fill', { style: `width:${pct}%` }),
    ])
  }

  function focusMeter(current) {
    const pct = Math.max(0, Math.min(100, Math.round((current.focus / Math.max(1, current.focusMax)) * 100)))
    return el('div.battle__focus', {}, [
      el('div.battle__focus-head', {}, [
        el('span', { text: 'FOCUS' }),
        el('span', { text: `${current.focus} / ${current.focusMax}` }),
      ]),
      el('span.meter', { dataset: { who: 'focus' } }, [
        el('span.meter__fill', { style: `width:${pct}%` }),
      ]),
    ])
  }

  function combatants() {
    const current = state()
    const foe = enemy()
    return el('div.fight', {}, [
      el('div.fighter', { dataset: { side: 'hero', boss: 'false' } }, [
        fighterVisual({ src: heroSpriteUrl(), alt: 'Tempered hero', glyph: 'train', attribute: 'might' }),
        el('span.fighter__name', { text: 'You' }),
        meter(current.heroHp, current.heroMax, 'hero'),
        el('span.fighter__hp', { text: `${Math.max(0, current.heroHp)} / ${current.heroMax}` }),
      ]),
      el('div.fight__vs', { text: `${current.defeated} / ${record.gauntlet.length}` }),
      el('div.fighter', { dataset: { side: 'enemy', boss: String(foe?.boss === true) } }, [
        fighterVisual({
          src: enemySpriteUrl(foe?.id),
          alt: foe?.name ?? 'Enemy',
          glyph: 'foe',
          attribute: foe?.boss ? 'vitality' : 'mind',
        }),
        el('span.fighter__name', { text: foe?.name ?? '—' }),
        meter(current.enemyHp ?? 0, current.enemyMax ?? 1, 'enemy'),
        el('span.fighter__hp', { text: foe ? `${Math.max(0, current.enemyHp)} / ${current.enemyMax}` : '' }),
      ]),
    ])
  }

  function eventLine(event) {
    const copy = {
      enemy: `${event.name} steps up`,
      guard: 'You guard and steady your focus',
      dodge: 'You move before the hit lands',
      defeated: `${event.name} falls`,
      won: 'The gauntlet is cleared',
      down: 'The gauntlet holds today',
      skipped: event.won ? 'Skipped to a cleared gauntlet' : `Skipped to result: ${event.defeated} down`,
    }[event.kind]

    if (event.kind === 'attack' || event.kind === 'skill') {
      return el('li.feed__line', { dataset: { by: 'hero', crit: String(event.crit === true) } }, [
        el('span.feed__what', { text: event.kind === 'skill' ? `Skill hits ${event.target ?? 'enemy'}` : `You hit ${event.target ?? 'enemy'}` }),
        el('span.feed__dmg', { text: `−${event.damage}${event.crit ? ' crit' : ''}` }),
      ])
    }
    if (event.kind === 'enemyHit') {
      return el('li.feed__line', { dataset: { by: 'enemy' } }, [
        el('span.feed__what', { text: event.guarded ? `Guard absorbs ${event.source ?? 'the'} hit` : `${event.source ?? 'Enemy'} hits you` }),
        el('span.feed__dmg', { text: `−${event.damage}` }),
      ])
    }
    return el('li.feed__line', { dataset: { by: 'note' } }, [
      el('span.feed__what', { text: copy ?? event.kind }),
    ])
  }

  function feed() {
    const log = state().log ?? []
    return el('ol.feed', {}, [...log].reverse().map(eventLine))
  }

  function result() {
    const current = state()
    const { rewards } = record
    return el('section.card.outcome', { dataset: { won: String(current.won) } }, [
      el('h2.block__title', { text: current.won ? 'Gauntlet cleared' : 'Battle complete' }),
      el('p.outcome__line', {
        text: current.won
          ? `All ${record.gauntlet.length} down, with ${current.heroHp} health left.`
          : `${current.defeated} of ${record.gauntlet.length} down. Nothing is lost.`,
      }),
      el('p.block__hint', { text: 'Daily rewards were locked when today’s encounter was generated. Battle never grants character XP.' }),
      el('div.outcome__rewards', {}, [
        el('span.reward', { dataset: { kind: 'gold' } }, [
          el('span.reward__value', { dataset: { acid: 'value' }, text: String(rewards.gold) }),
          el('span.reward__label', { text: 'DAILY GOLD' }),
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

  async function run(action) {
    if (busy) return
    busy = true
    render()
    try {
      record = await action()
    } finally {
      busy = false
      render()
    }
  }

  function actionButton(kind, title, sub, options = {}) {
    const dataset = { action: kind }
    if (options.primary) dataset.acid = 'primary'
    return el('button.battle-action', {
      type: 'button',
      disabled: busy || options.disabled,
      dataset,
      onclick: () => run(() => options.run()),
    }, [
      el('span.battle-action__title', { text: title }),
      el('span.battle-action__sub', { text: sub }),
    ])
  }

  function controls() {
    const current = state()
    if (current.status === 'finished') {
      return el('div.battle__controls', {}, [
        el('button.button', {
          type: 'button', disabled: busy, dataset: { battle: 'restart' },
          onclick: () => run(() => battle.restart(record.date)),
        }, [icon('history'), 'PLAY AGAIN']),
        el('button.button', {
          type: 'button', dataset: { battle: 'close', acid: 'primary' }, onclick: onClose,
        }, ['DONE']),
      ])
    }

    return el('div.battle-actions', {}, [
      actionButton('attack', 'ATTACK', 'Deal damage', { primary: true, run: () => battle.act('attack', record.date) }),
      actionButton('guard', 'GUARD', 'Reduce hit · restore Focus', { run: () => battle.act('guard', record.date) }),
      actionButton('skill', 'SKILL', 'Heavy hit · 1 Focus', {
        disabled: current.focus <= 0,
        run: () => battle.act('skill', record.date),
      }),
      actionButton('auto', 'AUTO', 'Let it play out', { run: () => battle.auto(record.date) }),
      actionButton('skip', 'SKIP', 'Instant result', { run: () => battle.skip(record.date) }),
    ])
  }

  function render() {
    if (!record?.turnState) {
      replace(root, [el('h1.screen__title', { text: 'Battle' }), el('p.block__hint', { text: 'Preparing today’s encounter…' })])
      return
    }

    const current = state()
    replace(root, [
      el('div.battle__head', {}, [
        el('div', {}, [
          el('h1.screen__title', { text: 'Daily Battle' }),
          el('p.battle__tagline', { text: 'Real effort. A stronger you.' }),
        ]),
        el('span.battle__rank', { text: `RANK ${record.rank}` }),
      ]),
      combatants(),
      focusMeter(current),
      current.status === 'active' && el('p.battle__prompt', { text: 'Choose an action.' }),
      controls(),
      feed(),
      current.status === 'finished' && result(),
      current.status === 'active' && el('button.button.button--quiet', {
        type: 'button', dataset: { battle: 'close' }, onclick: onClose,
      }, ['BACK TO APP']),
      el('p.block__hint', { text: 'Optional. Turn-based. No character XP from battles.' }),
    ])
  }

  return {
    root,
    async start() {
      record = await battle.stateForDate()
      render()
    },
    destroy() {},
  }
}
