/**
 * The shell: four tabs, global Settings access, and the session flow that
 * temporarily takes over.
 *
 * Settings is app-level navigation, not Character content. A compact persistent
 * control sits in the top-right on every normal screen. Immersive flows hide it
 * so a stray tap cannot interrupt a workout, battle, or summary.
 */

import { el, replace } from '../ui/dom.js'
import { icon } from './icons.js'
import { createTrainScreen } from './screens/train.js'
import { createSessionScreen } from './screens/session.js'
import { createSummaryScreen } from './screens/summary.js'
import { createHistoryScreen } from './screens/history.js'
import { createTodayScreen } from './screens/today.js'
import { createSettingsScreen } from './screens/settings.js'
import { createCharacterScreen } from './screens/character.js'
import { createBattleScreen } from './screens/battle.js'

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
 * @param {ReturnType<import('../app/daily.js').createDailyService>} deps.daily
 * @param {ReturnType<import('../app/character.js').createCharacterService>} deps.character
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {() => Promise<void>|void} [deps.onSetup]
 */
export function createApp({ mount, workout, daily, character, battle, maintenance, storage, clock, onSetup }) {
  const body = el('main.app__body')
  const tabBar = el('nav.tabbar', { 'aria-label': 'Sections' })
  const tabs = el('div.tabbar__tabs')
  const settingsAccess = el('button.settings-access', {
    type: 'button',
    'aria-label': 'Settings',
    title: 'Settings',
    dataset: { active: 'false' },
    onclick: () => show('settings'),
  }, [icon('equipment')])

  let active = 'train'
  /** Where the session was started from, so DONE returns there. */
  let returnTab = 'train'

  const train = createTrainScreen({
    workout, storage, clock,
    onStart: (options) => startSession(options),
  })
  const history = createHistoryScreen({ storage, workout })
  const settings = createSettingsScreen({ storage, daily, maintenance, onSetup })
  /** The battle takes over the shell the way a session does, and hands it back. */
  const battleScreen = battle
    ? createBattleScreen({ battle, onClose: () => show(returnTab === 'settings' ? 'character' : returnTab) })
    : null

  const characterScreen = createCharacterScreen({
    character, onSettings: () => show('settings'),
    onBattle: battleScreen ? () => openBattle() : null,
  })

  async function openBattle() {
    returnTab = active === 'settings' ? 'character' : active
    await battleScreen.start()
    replace(body, [battleScreen.root])
    tabBar.hidden = true
    settingsAccess.hidden = true
    body.scrollTop = 0
  }

  const today = createTodayScreen({
    workout, daily, clock,
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

  /** Which screen object backs each tab, for the FAB lookup above. */
  const SCREENS = { today, train, history, settings, character: characterScreen }

  /** @param {{routine?: any, programDay?: any, exerciseId?: string, slotTask?: any}} options */
  async function startSession(options) {
    returnTab = active === 'settings' ? 'character' : active
    session?.destroy()
    session = createSessionScreen({
      workout, clock,
      onFinish: async (result) => {
        session?.destroy()
        session = null
        // Nothing logged: close in silence. A summary of no sets, no volume and
        // no XP is a screen that reports nothing, and it reads like a rebuke.
        if (!result) {
          await show(returnTab)
          return
        }
        summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        settingsAccess.hidden = true
        body.scrollTop = 0
      },
    })
    await session.start(options)
    replace(body, [session.root])
    tabBar.hidden = true
    settingsAccess.hidden = true
    body.scrollTop = 0
  }

  async function show(tab) {
    active = tab
    session?.destroy()
    session = null
    battleScreen?.destroy()
    tabBar.hidden = false
    settingsAccess.hidden = false
    settingsAccess.dataset.active = String(tab === 'settings')
    settingsAccess.setAttribute('aria-current', tab === 'settings' ? 'page' : 'false')

    if (tab === 'train') { await train.refresh(); replace(body, [train.root]) }
    else if (tab === 'history') { await history.refresh(); replace(body, [history.root]) }
    else if (tab === 'today') { await today.refresh(); replace(body, [today.root]) }
    else if (tab === 'settings') { await settings.refresh(); replace(body, [settings.root]) }
    else { await characterScreen.refresh(); replace(body, [characterScreen.root]) }

    replace(tabs, TABS.map((entry) => el('button.tabbar__tab', {
      type: 'button',
      dataset: { tab: entry.id, active: String(active === entry.id || (active === 'settings' && entry.id === 'character')) },
      'aria-current': active === entry.id ? 'page' : null,
      onclick: () => show(entry.id),
    }, [entry.label])))

    // One primary action per screen, and only where the screen genuinely has one.
    const primary = SCREENS[tab]?.primary?.() ?? null
    replace(tabBar, [tabs, primary && el('button.fab', {
      type: 'button',
      'aria-label': primary.label,
      title: primary.label,
      dataset: { ...(primary.dataset ?? {}), acid: 'primary' },
      onclick: primary.run,
    }, [icon(primary.icon ?? 'play')])])

    body.scrollTop = 0
  }

  replace(mount, [body, settingsAccess, tabBar])
  return { show, startSession }
}
