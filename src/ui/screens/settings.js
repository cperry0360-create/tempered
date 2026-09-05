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
import { RESET_PHRASE } from '../../app/maintenance.js'
import { shortDate } from '../format.js'

/**
 * @param {object} deps
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {ReturnType<import('../../app/daily.js').createDailyService>} deps.daily
 * @param {ReturnType<import('../../app/maintenance.js').createMaintenanceService>} [deps.maintenance]
 */
export function createSettingsScreen({ storage, daily, maintenance }) {
  const root = el('div.screen.screen--settings')

  /** Typed into the reset box. Nothing happens until it says RESET. */
  let typed = ''
  /** What the last update check found, read once on arrival. */
  let update = null
  /** A backup taken this visit, so the link stays available after saving it. */
  let saved = null
  let busy = false

  /**
   * Hands the browser a file. `docs/02` already defines the export format; this
   * is only the delivery, and it is deliberately a real download rather than a
   * copyable blob of text — a backup you have to select and paste is a backup
   * nobody takes.
   */
  function download(filename, json) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = el('a', { href: url, download: filename })
    document.body.append(link)
    link.click()
    link.remove()
    // Revoked late: revoking before the click has been handled cancels it.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  /** Whether the typed phrase matches. The service checks again regardless. */
  const armed = () => typed.trim().toUpperCase() === RESET_PHRASE

  /**
   * Redraws with fresh data, without disturbing the update notice.
   *
   * Separate from `refresh` so that toggling a daily activity does not clear a
   * notice the person has not read yet, while arriving at the screen a second
   * time does.
   */
  async function load() {
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
              await load()
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

          // The result of the last check, said once. Installed to a home screen
          // there is no address bar and no reload button, so without this there
          // is no way to tell a build that failed to deploy from one that
          // deployed and did not fix the problem.
          update && el('p.notice', { dataset: { update: String(update.changed) } }, [
            update.changed
              ? `Updated — was ${update.before}, now ${update.after}.`
              : `No change — still ${update.after}. This is the newest build the server has.`,
          ]),

          maintenance && el('button.button', {
            type: 'button', disabled: busy, dataset: { action: 'check-updates' },
            onclick: async () => {
              busy = true
              await load()
              // Drops the worker and the caches, then reloads from the network.
              await maintenance.checkForUpdates()
            },
          }, [icon('history'), 'CHECK FOR UPDATES']),
        ]),

        // --- starting over ------------------------------------------------
        maintenance && el('section.card', { dataset: { section: 'reset' } }, [
          el('h2.block__title', { text: 'Reset all data' }),
          el('p.block__hint', {
            text: 'Erases every session, set, day and battle on this device and returns '
              + 'the app to first run. It cannot be undone, and it does not touch any '
              + 'backup you have already saved.',
          }),

          // Offered first, because after the reset there is nothing left to
          // export. The order is the whole point.
          el('button.button', {
            type: 'button', dataset: { action: 'backup' },
            onclick: async () => {
              const file = await maintenance.backup()
              download(file.filename, file.json)
              saved = file.filename
              await load()
            },
          }, [icon('down'), saved ? 'SAVE ANOTHER BACKUP' : 'SAVE A BACKUP FIRST']),

          saved && el('p.notice', { dataset: { saved: '' }, text: `Saved ${saved}.` }),

          el('label.reset__confirm', {}, [
            el('span.setting__label', { text: `Type ${RESET_PHRASE} to confirm` }),
            el('input.entry__value.reset__input', {
              type: 'text', value: typed, autocapitalize: 'characters',
              'aria-label': `Type ${RESET_PHRASE} to confirm the reset`,
              dataset: { entry: 'reset-confirm' },
              oninput: (event) => {
                typed = event.target.value
                // Only the button's own state changes, so the field keeps focus
                // and the caret stays where the thumb left it.
                const button = root.querySelector('[data-action="reset"]')
                if (button) button.disabled = !armed()
              },
            }),
          ]),

          el('button.button.button--danger', {
            type: 'button', disabled: !armed(),
            dataset: { action: 'reset' },
            onclick: async () => {
              const result = await maintenance.resetEverything({ confirmation: typed })
              // A refusal is the service's to give; the screen only relays it.
              if (!result.ok) {
                typed = ''
                await load()
              }
            },
          }, ['ERASE EVERYTHING']),
        ]),
      ])
    }
  }

  /**
   * Arriving at the screen.
   *
   * The update notice is read here and nowhere else, so it is said once: the
   * service clears its own record on the first read, and a second visit
   * therefore finds nothing to say. A notice that persisted would stop being
   * an answer to "did that do anything" and become furniture.
   */
  async function refresh() {
    update = maintenance?.updateResult() ?? null
    await load()
  }

  return { root, refresh }
}
