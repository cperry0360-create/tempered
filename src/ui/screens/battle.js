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
    return el('div.battle__focus', {}, [
      el('div.battle__stat-row', {}, [
        el('span.battle__stat-icon', { text: 'ϟ' }),
        el('span', { text: `FOCUS ${current.focus} / ${current.focusMax}` }),
      ]),
      meter(current.focus, current.focusMax, 'focus'),
    ])
  }

  function fighterPanel({ name, meta, hp, max, side, current }) {
    return el('div.fighter__panel', {}, [
      el('div.fighter__panel-head', {}, [
        el('span.fighter__name', { text: name }),
        el('span.fighter__meta', { text: meta }),
      ]),
      el('div.battle__stat-row', {}, [
        el('span.battle__stat-icon', { text: '♥' }),
        el('span.fighter__hp', { text: `HP ${Math.max(0, hp)} / ${max}` }),
      ]),
      meter(hp, max, side),
      side === 'hero' && focusMeter(current),
    ])
  }

  function combatants() {
    const current = state()
    const foe = enemy()
    const encounter = Math.min(record.gauntlet.length, current.enemyIndex + 1)
    return el('section.fight', { 'aria-label': 'Battlefield' }, [
      el('div.fighter', { dataset: { side: 'hero', boss: 'false' } }, [
        fighterPanel({
          name: 'You',
          meta: `RANK ${record.rank}`,
          hp: current.heroHp,
          max: current.heroMax,
          side: 'hero',
          current,
        }),
        fighterVisual({ src: heroSpriteUrl(), alt: 'Tempered hero', glyph: 'train', attribute: 'might' }),
      ]),
      el('div.fight__vs', { text: `${encounter} / ${record.gauntlet.length}` }),
      el('div.fighter', { dataset: { side: 'enemy', boss: String(foe?.boss === true) } }, [
        fighterPanel({
          name: foe?.name ?? 'Enemy',
          meta: foe?.boss ? 'BOSS' : `FOE ${encounter}`,
          hp: current.enemyHp ?? 0,
          max: current.enemyMax ?? 1,
          side: 'enemy',
          current,
        }),
        fighterVisual({
          src: enemySpriteUrl(foe?.id),
          alt: foe?.name ?? 'Enemy',
          glyph: 'foe',
          attribute: foe?.boss ? 'vitality' : 'mind',
        }),
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
    const foe = enemy()
    const lines = log.length
      ? [...log].reverse().map(eventLine)
      : [
          el('li.feed__line', { dataset: { by: 'note' } }, [
            el('span.feed__what', { text: `You face a ${foe?.name ?? 'foe'}!` }),
          ]),
          el('li.feed__line', { dataset: { by: 'note' } }, [
            el('span.feed__what', { text: 'Choose an action to begin.' }),
          ]),
          el('li.feed__cursor', { text: '_' }),
        ]
    return el('section.battle-log', {}, [el('ol.feed', {}, lines)])
  }

  function rewardPreview() {
    return el('aside.battle__rewards-preview', {}, [
      el('h2.battle__rewards-title', { text: 'Rewards (No Character XP)' }),
      el('div.battle__reward-row', {}, [
        el('span.battle__reward-glyph', { text: '●' }),
        el('span', { text: `${record.rewards.gold} Gold` }),
      ]),
      el('div.battle__reward-row', {}, [
        el('span.battle__reward-glyph', { text: '◆' }),
        el('span', { text: 'Items (chance)' }),
      ]),
      el('div.battle__reward-row', { dataset: { noxp: 'true' } }, [
        el('span.battle__reward-glyph', { text: '×' }),
        el('span', { text: 'No character XP' }),
      ]),
      el('p.battle__reward-note', { text: '(Progress comes from real effort)' }),
    ])
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

  function actionButton(kind, title, sub, glyph, options = {}) {
    const dataset = { action: kind }
    if (options.primary) dataset.acid = 'primary'
    return el('button.battle-action', {
      type: 'button',
      disabled: busy || options.disabled,
      dataset,
      onclick: () => run(() => options.run()),
    }, [
      el('span.battle-action__icon', { text: glyph }),
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
      actionButton('attack', 'ATTACK', 'Deal damage', '⚔', { primary: true, run: () => battle.act('attack', record.date) }),
      actionButton('guard', 'GUARD', 'Reduce next hit', '⬟', { run: () => battle.act('guard', record.date) }),
      actionButton('skill', 'SKILL', 'Use 1 Focus', '★', {
        disabled: current.focus <= 0,
        run: () => battle.act('skill', record.date),
      }),
      actionButton('auto', 'AUTO', 'Let it play out', '▶▶', { run: () => battle.auto(record.date) }),
      actionButton('skip', 'SKIP', 'Instant result', '➜', { run: () => battle.skip(record.date) }),
    ])
  }

  function header() {
    return el('header.battle__head', {}, [
      el('div.battle__brand', {}, [
        el('span.battle__brand-mark', { 'aria-hidden': 'true' }),
        el('span.battle__brand-name', { text: 'Tempered' }),
        el('span.battle__tagline', { text: 'Real effort. A stronger you.' }),
      ]),
      el('div.battle__daily', {}, [
        el('span.battle__daily-title', { text: 'Daily Battle' }),
        el('span.battle__daily-xp', { text: '+0 XP (battles don’t grant XP)' }),
      ]),
    ])
  }

  function render() {
    if (!record?.turnState) {
      replace(root, [el('h1.screen__title', { text: 'Battle' }), el('p.block__hint', { text: 'Preparing today’s encounter…' })])
      return
    }

    const current = state()
    replace(root, [
      el('div.battle-shell', {}, [
        header(),
        combatants(),
        el('div.battle__lower', {}, [
          el('div.battle__main', {}, [
            controls(),
            feed(),
          ]),
          rewardPreview(),
        ]),
        current.status === 'finished' && result(),
        current.status === 'active' && el('div.battle__utility', {}, [
          el('button.button.button--quiet', {
            type: 'button', dataset: { battle: 'close' }, onclick: onClose,
          }, ['BACK TO APP']),
        ]),
        el('footer.battle__footer', {}, [
          el('span', { text: 'Turn-based. Simple. Optional.' }),
          el('span', { text: 'Same journey. Stronger days.' }),
        ]),
      ]),
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
