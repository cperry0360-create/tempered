/**
 * CHARACTER — the RPG sheet for the person the tracker is building.
 *
 * The mandatory causal explanation remains intact: every attribute is tappable
 * and shows exactly what feeds it, what each source is worth, and what has fed
 * it so far. The surface around that explanation is intentionally game-like:
 * the approved battle art, the actual derived combat stats, rank/title, a relic
 * loadout, training record and direct access to the Daily Battle.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { xp as formatXp, shortDate } from '../format.js'
import { battlefieldUrl, heroSpriteUrl, itemSpriteUrl } from '../battle-art.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/character.js').createCharacterService>} deps.character
 */
export function createCharacterScreen({ character, onBattle }) {
  const root = el('div.screen.screen--character')
  /** @type {any} */ let view = null
  /** @type {string|null} */ let openAttribute = null
  let titlesOpen = false

  const oneDecimal = (value) => {
    const number = Number(value ?? 0)
    return Number.isInteger(number) ? String(number) : number.toFixed(1)
  }

  function attributeCard(attribute) {
    const open = openAttribute === attribute.id
    const { progress } = attribute

    return el('section.card.attr.character-attribute', {
      dataset: { attribute: attribute.id, open: String(open) },
    }, [
      el('button.attr__head', {
        type: 'button',
        'aria-expanded': String(open),
        dataset: { attr: attribute.id },
        onclick: () => { openAttribute = open ? null : attribute.id; render() },
      }, [
        el('div.attr__title', {}, [
          el('h2.attr__name', { text: attribute.name }),
          el('span.attr__tier', { text: attribute.tier }),
        ]),
        el('div.attr__numbers', {}, [
          el('span.attr__level', { text: String(attribute.level) }),
          el('span.attr__levellabel', { text: 'LEVEL' }),
        ]),
      ]),

      el('div.attr__bar', { style: `--fill:${Math.round(progress.fraction * 100)}%` }),
      el('p.attr__xp', {
        text: progress.isMax
          ? `${formatXp(attribute.xp)} XP · fully tempered`
          : `${formatXp(attribute.xp)} XP · ${formatXp(progress.xpToNextLevel)} to level ${attribute.level + 1}`,
      }),

      open && el('div.attr__detail', { dataset: { detail: attribute.id } }, [
        el('h3.attr__subhead', { text: 'What feeds it' }),
        el('div.feeds', {}, attribute.sources.map((source) => el('div.feed', {
          dataset: { feed: source.source },
        }, [
          el('span.feed__label', { text: source.label }),
          el('span.feed__worth', { text: source.worth }),
        ]))),

        attribute.contributors.length > 0 && el('h3.attr__subhead', { text: 'What has fed it' }),
        attribute.contributors.length > 0 && el('div.fed', {},
          attribute.contributors.map((entry) => el('div.fed__row', {
            dataset: { fed: entry.source },
          }, [
            el('span.fed__label', { text: entry.label }),
            el('span.fed__bar', { style: `--fill:${Math.round(entry.share * 100)}%` }),
            el('span.fed__xp', { text: formatXp(entry.xp) }),
          ]))),

        attribute.contributors.length === 0 && el('p.block__hint', {
          text: 'Nothing has fed this one yet. The list above is how it starts.',
        }),
      ]),
    ])
  }

  function stat(label, value, meta = '') {
    return el('div.character-stat', {}, [
      el('span.character-stat__value', { text: value }),
      el('span.character-stat__label', { text: label }),
      meta && el('span.character-stat__meta', { text: meta }),
    ])
  }

  function lootState() {
    const loot = Array.isArray(view?.loot) ? view.loot : []
    const counts = new Map()
    for (const item of loot) counts.set(item.id, (counts.get(item.id) ?? 0) + 1)

    const seen = new Set()
    const recentUnique = []
    for (let index = loot.length - 1; index >= 0; index -= 1) {
      const item = loot[index]
      if (!item?.id || seen.has(item.id)) continue
      seen.add(item.id)
      recentUnique.push(item)
    }

    return { loot, counts, recentUnique, slots: recentUnique.slice(0, 4) }
  }

  function loadoutSlot(item, index, counts) {
    if (!item) {
      return el('div.loadout-slot', { dataset: { empty: 'true', slot: String(index + 1) } }, [
        el('div.loadout-slot__empty', { text: '+' }),
        el('span.loadout-slot__name', { text: 'EMPTY' }),
      ])
    }

    const src = itemSpriteUrl(item.id)
    return el('div.loadout-slot', {
      dataset: { item: item.id, slot: String(index + 1) },
      title: item.flavour ?? item.name ?? item.id,
    }, [
      src && el('img.loadout-slot__art', {
        src,
        alt: '',
        'aria-hidden': 'true',
        draggable: false,
      }),
      el('span.loadout-slot__name', { text: item.name ?? item.id }),
      (counts.get(item.id) ?? 0) > 1 && el('span.loadout-slot__count', { text: `×${counts.get(item.id)}` }),
    ])
  }

  function renderHero(currentTitle) {
    const combat = view.combat ?? { health: 0, damage: 0, defence: 0, attackSpeed: 0, crit: 0 }
    const name = view.name?.trim() || 'THE TEMPERED'

    return el('section.character-hero', { dataset: { section: 'hero' } }, [
      el('div.character-hero__scene', {
        style: `--character-bg:url('${battlefieldUrl()}')`,
      }, [
        el('div.character-hero__top', {}, [
          el('div.character-rank', {}, [
            el('span.character-rank__label', { text: 'RANK' }),
            el('span.character-rank__letter', { dataset: { acid: 'value', rank: view.rank }, text: view.rank }),
          ]),
          el('div.character-wallet', {}, [
            el('span.character-wallet__coin', { text: '●' }),
            el('span.character-wallet__value', { text: String(view.gold ?? 0) }),
            el('span.character-wallet__label', { text: 'GOLD' }),
          ]),
        ]),

        el('img.character-hero__sprite', {
          src: heroSpriteUrl(),
          alt: `${name} RPG character`,
          draggable: false,
        }),

        el('div.character-hero__identity', {}, [
          el('p.character-hero__eyebrow', { text: 'YOUR CHARACTER' }),
          el('h2.character-hero__name', { text: name }),
          el('p.character-hero__title', { text: currentTitle ? currentTitle.name : 'Unproven' }),
          el('p.character-hero__levels', { text: `${view.totalLevels} total attribute levels` }),
        ]),

        onBattle && el('button.button.character-hero__battle', {
          type: 'button', dataset: { open: 'battle', acid: 'action' },
          onclick: () => onBattle(),
        }, ['ENTER BATTLE']),
      ]),

      el('div.character-combat', { 'aria-label': 'Combat stats' }, [
        stat('HP', String(Math.round(combat.health))),
        stat('DAMAGE', String(Math.round(combat.damage))),
        stat('DEFENCE', String(Math.round(combat.defence))),
        stat('SPEED', `${Number(combat.attackSpeed ?? 0).toFixed(2)}×`),
        stat('CRIT', `${Math.round((combat.crit ?? 0) * 100)}%`),
      ]),
    ])
  }

  function render() {
    if (!view) {
      replace(root, [el('h1.screen__title', { text: 'Character' })])
      return
    }

    const current = view.titles.earned.at(-1)
    const loot = lootState()
    const slots = Array.from({ length: 4 }, (_, index) => loot.slots[index] ?? null)

    replace(root, [
      el('div.character-pagehead', {}, [
        el('div', {}, [
          el('p.character-pagehead__eyebrow', { text: 'RPG PROFILE' }),
          el('h1.screen__title', { text: 'Character' }),
        ]),
        el('span.character-pagehead__rank', { text: `RANK ${view.rank}` }),
      ]),

      renderHero(current),

      el('section.character-record', { dataset: { section: 'record' } }, [
        stat('SESSIONS', String(view.facts?.sessionCount ?? 0)),
        stat('TRAINING', `${oneDecimal(view.facts?.trainingHours)}h`),
        stat('MILES', oneDecimal(view.facts?.milesCovered)),
        stat('GOOD SLEEP', String(view.facts?.inBandSleeps ?? 0), 'NIGHTS'),
      ]),

      view.directive && el('section.card.character-quest', { dataset: { section: 'directive' } }, [
        el('div.character-quest__badge', {}, [icon('bolt')]),
        el('div.character-quest__copy', {}, [
          el('p.character-quest__eyebrow', { text: 'ACTIVE DIRECTIVE' }),
          el('p.directive__headline', { text: view.directive.headline }),
          el('p.directive__detail', { text: view.directive.detail }),
        ]),
      ]),

      el('section.block.character-attributes', {}, [
        el('div.character-sectionhead', {}, [
          el('div', {}, [
            el('p.character-sectionhead__eyebrow', { text: 'REAL-LIFE PROGRESSION' }),
            el('h2.block__title', { text: 'Attributes' }),
          ]),
          el('p.block__hint', { text: 'Tap a stat to see exactly what feeds it.' }),
        ]),
        ...view.attributes.map(attributeCard),
      ]),

      el('section.card.character-loadout', { dataset: { section: 'loadout' } }, [
        el('div.character-sectionhead', {}, [
          el('div', {}, [
            el('p.character-sectionhead__eyebrow', { text: 'BATTLE RELICS' }),
            el('h2.block__title', { text: 'Loadout' }),
          ]),
          el('p.character-loadout__count', { text: `${loot.loot.length} collected · ${loot.recentUnique.length} unique` }),
        ]),
        el('div.loadout-grid', {}, slots.map((item, index) => loadoutSlot(item, index, loot.counts))),
        el('p.block__hint', {
          text: loot.loot.length > 0
            ? 'Your four most recently discovered relics are displayed here. Relics are cosmetic trophies and never alter your real-life stats.'
            : 'Battle relics you discover will appear here. They are cosmetic trophies and never alter your real-life stats.',
        }),
      ]),

      el('section.block.character-titles', { dataset: { section: 'titles' } }, [
        el('div.character-sectionhead', {}, [
          el('div', {}, [
            el('p.character-sectionhead__eyebrow', { text: 'ACHIEVEMENTS' }),
            el('h2.block__title', { text: 'Titles' }),
          ]),
        ]),
        view.titles.earned.length === 0
          ? el('p.block__hint', { text: 'None yet. Titles mark things you have done; they are never required.' })
          : el('div.titles', {}, view.titles.earned.map((title) => el('div.title', {
              dataset: { title: title.id },
            }, [
              el('span.title__name', { text: title.name }),
              el('span.title__date', { text: shortDate(title.earnedOn) }),
              el('span.title__why', { text: title.condition }),
            ]))),

        view.titles.available.length > 0 && el('button.worked__toggle', {
          type: 'button', dataset: { titles: 'toggle', open: String(titlesOpen) },
          onclick: () => { titlesOpen = !titlesOpen; render() },
        }, [icon(titlesOpen ? 'up' : 'down'), `${view.titles.available.length} STILL TO EARN`]),

        titlesOpen && el('div.titles', {}, view.titles.available.map((title) => el('div.title', {
          dataset: { available: title.id },
        }, [
          el('span.title__name', { text: title.name }),
          el('span.title__why', { text: title.condition }),
        ]))),
      ]),

      onBattle && el('section.character-battle-cta', { dataset: { section: 'battle' } }, [
        el('div', {}, [
          el('p.character-sectionhead__eyebrow', { text: 'DAILY ENCOUNTER' }),
          el('h2.block__title', { text: 'Battle' }),
          el('p.block__hint', { text: 'Your attributes become the hero above. The battle is optional and never grants character XP.' }),
        ]),
        el('button.button', {
          type: 'button', dataset: { open: 'battle-bottom' },
          onclick: () => onBattle(),
        }, ['OPEN BATTLE']),
      ]),
    ])
  }

  return {
    root,
    async refresh() {
      view = await character.view()
      render()
    },
  }
}
