/**
 * CHARACTER — the reward surface, where progression is made legible.
 *
 * `docs/03-screens.md` calls one thing here mandatory: tap an attribute and see
 * exactly which activities feed it, what each is worth, and what has actually
 * fed it so far. That is the app's answer to "why did that go up", and without
 * it the progression layer is a slot machine.
 *
 * This is the one screen where the five attribute colours belong —
 * `docs/04-design-system.md` says they live here and on the post-session
 * readout, and never in the tracker. Everything else on this screen is the same
 * dark surface as the rest of the app.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { xp as formatXp, shortDate } from '../format.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/character.js').createCharacterService>} deps.character
 * @param {() => void} deps.onSettings
 */
export function createCharacterScreen({ character, onSettings }) {
  const root = el('div.screen.screen--character')
  /** @type {any} */ let view = null
  /** @type {string|null} */ let openAttribute = null
  let titlesOpen = false

  function attributeCard(attribute) {
    const open = openAttribute === attribute.id
    const { progress } = attribute

    return el('section.card.attr', {
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

      // The mandatory view. Rendered on demand rather than fetched on demand —
      // everything it needs is already here.
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

  function render() {
    if (!view) {
      replace(root, [el('h1.screen__title', { text: 'Character' })])
      return
    }

    const current = view.titles.earned.at(-1)

    replace(root, [
      el('h1.screen__title', { text: 'Character' }),

      // 1. Rank and identity.
      el('section.card.rank', { dataset: { section: 'rank' } }, [
        el('span.rank__letter', { dataset: { acid: 'value', rank: view.rank }, text: view.rank }),
        el('div.rank__main', {}, [
          el('p.rank__title', { text: current ? current.name : 'Unproven' }),
          el('p.rank__meta', {
            text: `${view.totalLevels} levels across five attributes`,
          }),
        ]),
      ]),

      // 2 and 3. The attributes, each one openable.
      el('section.block', {}, [
        el('h2.block__title', { text: 'Attributes' }),
        el('p.block__hint', { text: 'Tap one to see what feeds it, and what has.' }),
        ...view.attributes.map(attributeCard),
      ]),

      // 4. The active directive.
      view.directive && el('section.card', { dataset: { section: 'directive' } }, [
        el('h2.block__title', { text: 'Directive' }),
        el('p.directive__headline', { text: view.directive.headline }),
        el('p.directive__detail', { text: view.directive.detail }),
      ]),

      // 5. Titles, with the date and what earned them.
      el('section.block', { dataset: { section: 'titles' } }, [
        el('h2.block__title', { text: 'Titles' }),
        view.titles.earned.length === 0
          ? el('p.block__hint', { text: 'None yet. They are flavour, not currency — nothing depends on having one.' })
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

      // 6. The battle, which arrives in Phase 6.
      el('section.card', { dataset: { section: 'battle' } }, [
        el('h2.block__title', { text: 'Battle' }),
        el('p.block__hint', {
          text: 'The daily battle arrives in Phase 6. Your attributes are already what it will fight with.',
        }),
      ]),

      el('button.button.button--quiet.button--wide', {
        type: 'button', dataset: { tab: 'settings' }, onclick: onSettings,
      }, ['SETTINGS']),
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
