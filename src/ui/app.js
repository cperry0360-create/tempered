/**
 * The shell: four tabs, and the session flow that temporarily takes over.
 *
 * Four tabs, per `docs/03-screens.md`. Today and Character are Phase 4 and 5 —
 * they are present so the shape of the app is honest, and say plainly that they
 * are not built rather than showing an empty screen that looks broken.
 */

import { el, replace } from '../ui/dom.js'
import { createTrainScreen } from './screens/train.js'
import { createSessionScreen } from './screens/session.js'
import { createSummaryScreen } from './screens/summary.js'
import { createHistoryScreen } from './screens/history.js'
import { createTodayScreen } from './screens/today.js'
import { createSettingsScreen } from './screens/settings.js'

const TABS = [
  { id: 'today', label: 'TODAY' },
  { id: 'train', label: 'TRAIN' },
  { id: 'character', label: 'CHARACTER' },
  { id: 'history', label: 'HISTORY' },
]

/**
 * @param {object} deps
 * @param {HTMLElement} deps.mount
 * @param {ReturnType<import('../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 */
export function createApp({ mount, workout, storage, clock }) {
  const body = el('main.app__body')
  const tabBar = el('nav.tabbar', { 'aria-label': 'Sections' })
  let active = 'train'
  /** Where the session was started from, so DONE returns there. */
  let returnTab = 'train'

  const train = createTrainScreen({
    workout, storage, clock,
    onStart: (options) => startSession(options),
  })
  const history = createHistoryScreen({ storage, workout })
  const settings = createSettingsScreen({ storage })
  const today = createTodayScreen({
    workout, clock,
    onStart: (options) => startSession(options),
    // A slot opened from Today is a session of exactly one exercise, carrying
    // its slot identity so the work counts against the day it was prescribed for.
    onOpenSlot: (slot) => startSession({ slotTask: slot }),
  })
  const summary = createSummaryScreen({
    // Back where you came from: a slot opened from Today returns to Today, not
    // to Train, which is a different screen than the one you were working in.
    onDone: async () => { await show(returnTab) },
  })
  let session = null

  function placeholder(title, note) {
    return el('div.screen', {}, [
      el('h1.screen__title', { text: title }),
      el('p.block__hint', { text: note }),
    ])
  }

  /** @param {{routine?: any, programDay?: any, exerciseId?: string, slotTask?: any}} options */
  async function startSession(options) {
    returnTab = active === 'settings' ? 'character' : active
    session?.destroy()
    session = createSessionScreen({
      workout, clock,
      onFinish: async (result) => {
        session?.destroy()
        session = null
        summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        body.scrollTop = 0
      },
    })
    await session.start(options)
    replace(body, [session.root])
    tabBar.hidden = true
    body.scrollTop = 0
  }

  async function show(tab) {
    active = tab
    session?.destroy()
    session = null
    tabBar.hidden = false

    if (tab === 'train') { await train.refresh(); replace(body, [train.root]) }
    else if (tab === 'history') { await history.refresh(); replace(body, [history.root]) }
    else if (tab === 'today') { await today.refresh(); replace(body, [today.root]) }
    else if (tab === 'settings') { await settings.refresh(); replace(body, [settings.root]) }
    else {
      replace(body, [
        placeholder('Character', 'The progression surface arrives in Phase 5. Your XP is being recorded already.'),
        el('button.button.button--quiet.button--wide', {
          type: 'button', dataset: { tab: 'settings' }, onclick: () => show('settings'),
        }, ['SETTINGS']),
      ])
    }

    replace(tabBar, TABS.map((entry) => el('button.tabbar__tab', {
      type: 'button',
      dataset: { tab: entry.id, active: String(active === entry.id || (active === 'settings' && entry.id === 'character')) },
      'aria-current': active === entry.id ? 'page' : null,
      onclick: () => show(entry.id),
    }, [entry.label])))
    body.scrollTop = 0
  }

  replace(mount, [body, tabBar])
  return { show, startSession }
}
