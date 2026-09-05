/** SETTINGS. */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { VERSION, BUILD_DATE } from '../../version.js'
import { RESET_PHRASE } from '../../app/maintenance.js'
import { shortDate } from '../format.js'

const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

export function createSettingsScreen({ storage, daily, workout, maintenance, onSetup }) {
  const root = el('div.screen.screen--settings')
  let typed = ''
  let update = null
  let saved = null
  let busy = false

  function download(filename, json) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = el('a', { href: url, download: filename })
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const armed = () => typed.trim().toUpperCase() === RESET_PHRASE

  function cadenceButton(activity, current, cadence, label) {
    return el('button.setup__cadence', {
      type: 'button',
      dataset: { selected: String(current.cadence === cadence) },
      onclick: async () => {
        await daily.setCadence(activity.id, cadence, cadence === 'weekly' ? current.target : 1)
        await load()
      },
    }, [label])
  }

  async function load() {
    const profile = await storage.get('profile', 'profile')
    const schedule = await daily.activitySchedule()
    const weekStatus = workout ? await workout.weekStatus() : null
    const exerciseTargets = workout ? await workout.exerciseFrequencyTargets() : {}
    const exerciseGroups = new Map()
    for (const day of weekStatus?.week?.days ?? []) {
      for (const task of day.tasks ?? []) {
        const id = task.slot.exerciseId
        const row = exerciseGroups.get(id) ?? { id, name: task.slot.name, programTarget: 0 }
        row.programTarget += 1
        exerciseGroups.set(id, row)
      }
    }

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
        onSetup && el('button.button', {
          type: 'button', dataset: { action: 'rerun-setup' }, onclick: () => onSetup(),
        }, ['RE-RUN SETUP']),
      ]),

      el('section.card', { dataset: { section: 'targets' } }, [
        el('h2.block__title', { text: 'Daily targets' }),
        el('p.block__hint', { text: 'Protein is calculated from body weight. Calories are your configurable daily target.' }),
        el('div.setting', {}, [
          el('span.setting__label', { text: 'Calories' }),
          (() => {
            const input = el('input.entry__value', {
              type: 'text', inputmode: 'numeric', value: profile?.calorieTarget ?? '', placeholder: 'Not set',
              'aria-label': 'Daily calorie target',
            })
            return el('span.setting__value', {}, [
              input,
              el('button.setup__cadence', {
                type: 'button', onclick: async () => { await daily.setCalorieTarget(input.value); await load() },
              }, ['SAVE']),
            ])
          })(),
        ]),
      ]),

      el('section.card', { dataset: { section: 'cadence' } }, [
        el('h2.block__title', { text: 'Tracking cadence' }),
        el('p.block__hint', {
          text: 'Daily resets each morning. Weekly can be completed on any day and shows progress on Today.',
        }),
        el('div.setup__cadencelist', {}, daily.activities.map((activity) => {
          const current = schedule[activity.id] ?? { cadence: 'off', target: 1 }
          return el('div.setup__cadencerow', {}, [
            el('div.setup__cadencehead', {}, [
              el('span.setup__activityname', { text: activity.name }),
              current.cadence === 'weekly' && el('select.setup__weeklyselect', {
                value: String(current.target),
                'aria-label': `${activity.name} times per week`,
                onchange: async (event) => {
                  await daily.setCadence(activity.id, 'weekly', Number(event.target.value))
                  await load()
                },
              }, WEEKLY_OPTIONS.map((value) => el('option', { value: String(value) }, [`${value}×/wk`]))),
            ]),
            el('div.setup__cadencechoices', {}, [
              cadenceButton(activity, current, 'off', 'OFF'),
              cadenceButton(activity, current, 'daily', 'DAILY'),
              cadenceButton(activity, current, 'weekly', current.cadence === 'weekly' ? `${current.target}× / WK` : 'WEEKLY'),
            ]),
          ])
        })),
      ]),

      exerciseGroups.size > 0 && el('section.card', { dataset: { section: 'exercise-frequency' } }, [
        el('h2.block__title', { text: 'Exercise frequency' }),
        el('p.block__hint', { text: 'PROGRAM follows the current plan. Choose a number to override how often that exercise should be completed this week.' }),
        el('div.setup__cadencelist', {}, [...exerciseGroups.values()].sort((a, b) => a.name.localeCompare(b.name)).map((exercise) =>
          el('div.setup__cadencerow', {}, [
            el('div.setup__cadencehead', {}, [
              el('span.setup__activityname', { text: exercise.name }),
              el('select.setup__weeklyselect', {
                value: exerciseTargets[exercise.id] ? String(exerciseTargets[exercise.id]) : '',
                'aria-label': `${exercise.name} weekly frequency`,
                onchange: async (event) => {
                  await workout.setExerciseFrequencyTarget(exercise.id, event.target.value === '' ? null : Number(event.target.value))
                  await load()
                },
              }, [
                el('option', { value: '' }, [`PROGRAM (${exercise.programTarget}×/wk)`]),
                ...WEEKLY_OPTIONS.map((value) => el('option', { value: String(value) }, [`${value}×/wk`])),
              ]),
            ]),
          ]))),
      ]),

      el('section.card', { dataset: { section: 'credits' } }, [
        el('h2.block__title', { text: 'Credits' }),
        el('p.block__hint', {
          text: 'Exercise movement images come from free-exercise-db and upstream Everkinetic material. Tempered treats those images as CC BY-SA 4.0 and keeps their exact provenance in art/exercises/SOURCES.json.',
        }),
        el('p.block__hint', {
          text: 'Third-party exercise art is licensed separately. Any licence that applies to Tempered source code or first-party art does not automatically cover those images.',
        }),
        el('p.setting', {}, [
          el('a', {
            href: 'https://github.com/yuhonas/free-exercise-db',
            target: '_blank', rel: 'noopener noreferrer', text: 'free-exercise-db',
          }),
          el('a', {
            href: 'https://creativecommons.org/licenses/by-sa/4.0/',
            target: '_blank', rel: 'noopener noreferrer', text: 'CC BY-SA 4.0',
          }),
        ]),
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
          text: 'The service worker cache is keyed to this version, so a new version always replaces the old one.',
        }),
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
            await maintenance.checkForUpdates()
          },
        }, [icon('history'), 'CHECK FOR UPDATES']),
      ]),

      maintenance && el('section.card', { dataset: { section: 'reset' } }, [
        el('h2.block__title', { text: 'Reset all data' }),
        el('p.block__hint', {
          text: 'Erases every session, set, day and battle on this device and returns the app to first run. It cannot be undone.',
        }),
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
            oninput: (event) => {
              typed = event.target.value
              const button = root.querySelector('[data-action="reset"]')
              if (button) button.disabled = !armed()
            },
          }),
        ]),
        el('button.button.button--danger', {
          type: 'button', disabled: !armed(), dataset: { action: 'reset' },
          onclick: async () => {
            const result = await maintenance.resetEverything({ confirmation: typed })
            if (!result.ok) { typed = ''; await load() }
          },
        }, ['ERASE EVERYTHING']),
      ]),
    ])
  }

  async function refresh() {
    update = maintenance?.updateResult() ?? null
    busy = false
    await load()
  }

  return { root, refresh }
}
