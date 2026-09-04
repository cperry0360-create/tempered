/**
 * SETTINGS.
 *
 * Carries the build's identity, which matters more than it looks: installed to a
 * home screen there is no address bar and no reload button, so without a visible
 * version there is no way to tell a build that failed to deploy from one that
 * deployed and did not fix the problem.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { VERSION, BUILD_DATE } from '../../version.js'
import { shortDate } from '../format.js'

/**
 * @param {object} deps
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {ReturnType<import('../../app/daily.js').createDailyService>} deps.daily
 */
export function createSettingsScreen({ storage, daily }) {
  const root = el('div.screen.screen--settings')

  async function refresh() {
    {
      const profile = await storage.get('profile', 'profile')
      const chosen = new Set(await daily.dailyIds())
      replace(root, [
        el('h1.screen__title', { text: 'Settings' }),

        el('section.card', {}, [
          el('h2.block__title', { text: 'Plan' }),
          el('p.setting', {}, [
            el('span.setting__label', { text: 'Sessions per week' }),
            el('span.setting__value', { text: String(profile?.planTargetSessionsPerWeek ?? 4) }),
          ]),
          el('p.setting', {}, [
            el('span.setting__label', { text: 'Units' }),
            el('span.setting__value', { text: profile?.units ?? 'imperial' }),
          ]),
        ]),

        // The daily list. Setup will own this in Phase 7; until then it lives
        // here, because a default nobody can change is not a default.
        el('section.card', { dataset: { section: 'daily' } }, [
          el('h2.block__title', { text: 'Daily list' }),
          el('p.block__hint', {
            text: 'What Today asks you about every day. Everything else stays one tap '
              + 'away under "log something else", and is worth exactly the same either way.',
          }),
          el('div.marks', {}, daily.activities.map((activity) => el('button.mark', {
            type: 'button',
            'aria-pressed': String(chosen.has(activity.id)),
            dataset: { daily: activity.id, on: String(chosen.has(activity.id)) },
            onclick: async () => {
              await daily.setDaily(activity.id, !chosen.has(activity.id))
              await refresh()
            },
          }, [chosen.has(activity.id) ? icon('check') : icon('plus'), activity.name]))),
        ]),

        el('section.card', { dataset: { section: 'version' } }, [
          el('h2.block__title', { text: 'Build' }),
          el('p.setting', {}, [
            el('span.setting__label', { text: 'Version' }),
            el('span.setting__value', { dataset: { version: '' }, text: VERSION }),
          ]),
          el('p.setting', {}, [
            el('span.setting__label', { text: 'Last updated' }),
            el('span.setting__value', { dataset: { builddate: '' }, text: shortDate(BUILD_DATE) }),
          ]),
          el('p.block__hint', {
            text: 'The service worker cache is keyed to this version, so a new version '
              + 'always replaces the old one rather than sitting behind it.',
          }),
        ]),
      ])
    }
  }

  return { root, refresh }
}
