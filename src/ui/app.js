/**
 * The shell: four tabs, global Settings access, and immersive workout/battle
 * flows that temporarily take over.
 *
 * Phase 8 makes async failures recoverable. A failed refresh, session start or
 * battle start never leaves a blank app: the shell renders an accessible error
 * state with retry/back actions and keeps the user's data untouched.
 */

import { el, replace } from '../ui/dom.js'
import { errorState, liveRegion } from './states.js'
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

const tabLabel = (id) => TABS.find((entry) => entry.id === id)?.label ?? 'SETTINGS'

export function createApp({ mount, workout, daily, character, battle, maintenance, storage, clock, onSetup }) {
  const body = el('main.app__body', { 'aria-busy': 'false' })
  const announcer = liveRegion()
  const tabBar = el('nav.tabbar', { 'aria-label': 'Sections' })
  const tabs = el('div.tabbar__tabs')
  const settingsAccess = el('button.settings-access', {
    type: 'button', 'aria-label': 'Settings', title: 'Settings',
    dataset: { active: 'false' }, onclick: () => show('settings'),
  }, [icon('gear')])

  let active = 'train'
  let returnTab = 'train'

  const train = createTrainScreen({ workout, storage, clock, onStart: (options) => startSession(options) })
  const history = createHistoryScreen({ storage, workout })
  const settings = createSettingsScreen({ storage, daily, workout, maintenance, onSetup })
  const battleScreen = battle
    ? createBattleScreen({ battle, onClose: () => show(returnTab === 'settings' ? 'character' : returnTab) })
    : null

  const characterScreen = createCharacterScreen({
    character,
    onSettings: () => show('settings'),
    onBattle: battleScreen ? () => openBattle() : null,
  })

  const today = createTodayScreen({
    workout, daily, clock,
    onStart: (options) => startSession(options),
    onOpenSlot: (slot) => slot?.extra
      ? startSession({ exerciseId: slot.exerciseId })
      : startSession({ slotTask: slot }),
  })

  const summary = createSummaryScreen({ onDone: async () => { await show(returnTab) } })
  let session = null
  const SCREENS = { today, train, history, settings, character: characterScreen }

  function announce(text) {
    // Clearing first makes repeated visits to the same tab announce again.
    announcer.textContent = ''
    queueMicrotask(() => { announcer.textContent = text })
  }

  function renderTabs(tab) {
    replace(tabs, TABS.map((entry) => el('button.tabbar__tab', {
      type: 'button',
      dataset: { tab: entry.id, active: String(tab === entry.id || (tab === 'settings' && entry.id === 'character')) },
      'aria-current': tab === entry.id ? 'page' : null,
      'aria-label': `${entry.label.toLowerCase()} section`,
      onclick: () => show(entry.id),
    }, [entry.label])))

    const primary = SCREENS[tab]?.primary?.() ?? null
    replace(tabBar, [tabs, primary && el('button.fab', {
      type: 'button', 'aria-label': primary.label, title: primary.label,
      dataset: { ...(primary.dataset ?? {}), acid: 'primary' },
      onclick: primary.run,
    }, [icon(primary.icon ?? 'play')])])
  }

  function showFailure({ title, detail, retry, back }) {
    tabBar.hidden = false
    settingsAccess.hidden = false
    replace(body, [errorState({
      title,
      detail,
      onRetry: retry,
      onBack: back,
    })])
    body.scrollTop = 0
    announce(title)
  }

  async function openBattle() {
    returnTab = active === 'settings' ? 'character' : active
    body.setAttribute('aria-busy', 'true')
    try {
      await battleScreen.start()
      replace(body, [battleScreen.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Today’s battle')
    } catch (error) {
      console.error('[tempered] battle failed to start', error)
      showFailure({
        title: 'Battle could not open',
        detail: 'Nothing was lost. You can retry the battle or return to Character.',
        retry: () => openBattle(),
        back: () => show('character'),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function startSession(options) {
    returnTab = active === 'settings' ? 'character' : active
    session?.destroy()
    session = createSessionScreen({
      workout, clock,
      onFinish: async (result) => {
        session?.destroy()
        session = null
        if (!result) { await show(returnTab); return }
        summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        settingsAccess.hidden = true
        body.scrollTop = 0
        announce('Workout summary')
      },
    })

    body.setAttribute('aria-busy', 'true')
    try {
      await session.start(options)
      replace(body, [session.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Workout session')
    } catch (error) {
      console.error('[tempered] session failed to start', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not open',
        detail: 'Nothing was logged or removed. Try again, or return to where you were.',
        retry: () => startSession(options),
        back: () => show(returnTab),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function refreshScreen(tab) {
    if (tab === 'train') { await train.refresh(); replace(body, [train.root]); return }
    if (tab === 'history') { await history.refresh(); replace(body, [history.root]); return }
    if (tab === 'today') { await today.refresh(); replace(body, [today.root]); return }
    if (tab === 'settings') { await settings.refresh(); replace(body, [settings.root]); return }
    await characterScreen.refresh()
    replace(body, [characterScreen.root])
  }

  async function show(tab) {
    const target = tab === 'settings' || TABS.some((entry) => entry.id === tab) ? tab : 'today'
    active = target
    session?.destroy()
    session = null
    battleScreen?.destroy()
    tabBar.hidden = false
    settingsAccess.hidden = false
    settingsAccess.dataset.active = String(target === 'settings')
    settingsAccess.setAttribute('aria-current', target === 'settings' ? 'page' : 'false')
    renderTabs(target)

    body.setAttribute('aria-busy', 'true')
    try {
      await refreshScreen(target)
      // A screen's primary action can depend on data loaded by refresh. Render
      // the bar again after that data exists so the FAB is never one visit late.
      renderTabs(target)
      body.scrollTop = 0
      announce(`${tabLabel(target).toLowerCase()} screen`)
    } catch (error) {
      console.error(`[tempered] ${target} failed to load`, error)
      showFailure({
        title: `${tabLabel(target)} could not load`,
        detail: 'Your saved data was not changed. Try this screen again.',
        retry: () => show(target),
        back: target === 'today' ? null : () => show('today'),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  replace(mount, [body, announcer, settingsAccess, tabBar])
  return { show, startSession }
}
