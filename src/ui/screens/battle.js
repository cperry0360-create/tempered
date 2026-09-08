/**
 * EXPEDITION — the optional daily roguelite run.
 *
 * Real training owns permanent progression. The three encounters and their
 * upgrade choices only change today's run; daily rewards are still generated
 * once and AUTO / SKIP remain available at every combat encounter.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { heroSpriteUrl, enemySpriteUrl, itemSpriteUrl } from '../battle-art.js'
import { expeditionUpgrade } from '../../domain/expedition.js'

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
  const runState = () => record?.expedition ?? null
  const enemy = () => {
    const current = state()
    if (!current) return null
    const globalIndex = (current.globalOffset ?? 0) + current.enemyIndex
    return record.gauntlet?.[globalIndex] ?? null
  }

  const totalDefeated = () => {
    const current = state()
    if (!current) return 0
    return Math.min(record.gauntlet?.length ?? 0, (current.globalOffset ?? 0) + (current.defeated ?? 0))
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
    const expedition = runState()
    const foe = enemy()
    const overallFoe = Math.min(record.gauntlet.length, (current.globalOffset ?? 0) + current.enemyIndex + 1)
    const encounter = Math.min(expedition?.encounterCount ?? 1, (expedition?.encounterIndex ?? 0) + 1)
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
      el('div.fight__vs', {
        text: `ENCOUNTER ${encounter} / ${expedition?.encounterCount ?? 1}`,
        dataset: { expeditionEncounter: String(encounter) },
      }),
      el('div.fighter', { dataset: { side: 'enemy', boss: String(foe?.boss === true) } }, [
        fighterPanel({
          name: foe?.name ?? 'Enemy',
          meta: foe?.boss ? 'BOSS' : `FOE ${overallFoe}`,
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

  function buildStrip() {
    const expedition = runState()
    const upgrades = (expedition?.upgrades ?? []).map(expeditionUpgrade).filter(Boolean)
    return el('section.expedition-strip', { 'aria-label': 'Expedition build' }, [
      el('div.expedition-strip__progress', {}, Array.from({ length: expedition?.encounterCount ?? 0 }, (_, index) => {
        const active = index === expedition.encounterIndex && expedition.phase !== 'complete'
        const cleared = index < expedition.encounterIndex
          || (expedition.phase === 'complete' && state()?.won === true && index <= expedition.encounterIndex)
        return el('span.expedition-dot', {
          dataset: { active: String(active), cleared: String(cleared) },
          'aria-label': `Encounter ${index + 1}${cleared ? ' cleared' : active ? ' active' : ''}`,
        }, [String(index + 1)])
      })),
      el('div.expedition-strip__build', {}, [
        el('span.expedition-strip__label', { text: 'RUN BUILD' }),
        upgrades.length
          ? el('div.expedition-chips', {}, upgrades.map((upgrade) => el('span.expedition-chip', {
              dataset: { upgrade: upgrade.id }, text: upgrade.name,
            })))
          : el('span.expedition-strip__empty', { text: 'No upgrades yet' }),
      ]),
    ])
  }

  function eventLine(event) {
    const copy = {
      enemy: `${event.name} steps up`,
      guard: 'You guard and steady your focus',
      dodge: 'You move before the hit lands',
      defeated: `${event.name} falls`,
      won: 'Encounter cleared',
      down: 'This run ends here',
      skipped: event.won ? 'Skipped to a cleared expedition' : `Skipped to result: ${event.defeated} down`,
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
      el('h2.battle__rewards-title', { text: 'Daily reward (No Character XP)' }),
      el('div.battle__reward-row', {}, [
        el('span.battle__reward-glyph', { text: '●' }),
        el('span', { text: `${record.rewards.gold} Gold` }),
      ]),
      el('div.battle__reward-row', {}, [
        el('span.battle__reward-glyph', { text: '◆' }),
        el('span', { text: record.rewards.item ? record.rewards.item.name : 'Item chance' }),
      ]),
      el('div.battle__reward-row', { dataset: { noxp: 'true' } }, [
        el('span.battle__reward-glyph', { text: '×' }),
        el('span', { text: 'No character XP' }),
      ]),
      el('p.battle__reward-note', { text: 'Permanent progress still comes from real effort.' }),
    ])
  }

  function result() {
    const current = state()
    const { rewards } = record
    const defeated = totalDefeated()
    return el('section.card.outcome', { dataset: { won: String(current.won) } }, [
      el('h2.block__title', { text: current.won ? 'Expedition cleared' : 'Expedition complete' }),
      el('p.outcome__line', {
        text: current.won
          ? `All ${record.gauntlet.length} down, with ${current.heroHp} health left.`
          : `${defeated} of ${record.gauntlet.length} down. Nothing is lost.`,
      }),
      el('p.block__hint', {
        text: `Your ${(runState()?.upgrades ?? []).length} run upgrade${(runState()?.upgrades ?? []).length === 1 ? '' : 's'} end here. Daily rewards were locked when this expedition was generated; it never grants character XP.`,
      }),
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

  function upgradeChoices() {
    const expedition = runState()
    return el('section.upgrade-choice', { dataset: { expeditionChoice: String(expedition.encounterIndex) } }, [
      el('div.upgrade-choice__head', {}, [
        el('span.upgrade-choice__eyebrow', { text: `ENCOUNTER ${expedition.encounterIndex + 1} CLEARED` }),
        el('h2.upgrade-choice__title', { text: 'Choose 1 upgrade' }),
        el('p.upgrade-choice__copy', { text: 'It lasts for this expedition only. Your real-world character stats are unchanged.' }),
      ]),
      el('div.upgrade-choice__cards', {}, (expedition.choices ?? []).map((choice, index) => el('button.upgrade-card', {
        type: 'button', disabled: busy,
        dataset: { upgrade: choice.id, pick: String(index + 1) },
        onclick: () => run(() => battle.chooseUpgrade(choice.id, record.date)),
      }, [
        el('span.upgrade-card__pick', { text: `PICK ${index + 1}` }),
        el('strong.upgrade-card__name', { text: choice.name }),
        el('span.upgrade-card__description', { text: choice.description }),
      ]))),
    ])
  }

  function controls() {
    const current = state()
    const expedition = runState()

    if (expedition?.phase === 'choice') return upgradeChoices()

    if (expedition?.phase === 'complete') {
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
      actionButton('auto', 'AUTO', 'Finish the run', '▶▶', { run: () => battle.auto(record.date) }),
      actionButton('skip', 'SKIP', 'Instant result', '➜', { run: () => battle.skip(record.date) }),
    ])
  }

  function header() {
    const expedition = runState()
    return el('header.battle__head', {}, [
      el('div.battle__brand', {}, [
        el('span.battle__brand-mark', { 'aria-hidden': 'true' }),
        el('span.battle__brand-name', { text: 'Tempered' }),
        el('span.battle__tagline', { text: 'Real effort. Build the run.' }),
      ]),
      el('div.battle__daily', {}, [
        el('span.battle__daily-title', { text: 'Daily Expedition' }),
        el('span.battle__daily-xp', {
          text: expedition?.upgrades?.length
            ? `${expedition.upgrades.length} temporary upgrade${expedition.upgrades.length === 1 ? '' : 's'} equipped`
            : '3 encounters · run-only upgrades',
        }),
      ]),
    ])
  }

  function render() {
    if (!record?.turnState || !record?.expedition) {
      replace(root, [el('h1.screen__title', { text: 'Expedition' }), el('p.block__hint', { text: 'Preparing today’s run…' })])
      return
    }

    const expedition = runState()
    replace(root, [
      el('div.battle-shell', {}, [
        header(),
        buildStrip(),
        combatants(),
        el('div.battle__lower', {}, [
          el('div.battle__main', {}, [
            controls(),
            feed(),
          ]),
          rewardPreview(),
        ]),
        expedition.phase === 'complete' && result(),
        expedition.phase !== 'complete' && el('div.battle__utility', {}, [
          el('button.button.button--quiet', {
            type: 'button', dataset: { battle: 'close' }, onclick: onClose,
          }, ['BACK TO APP']),
        ]),
        el('footer.battle__footer', {}, [
          el('span', { text: '3 encounters. Choose a build as you go.' }),
          el('span', { text: 'Run upgrades reset. Real progress stays.' }),
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
