/**
 * The app shell. The visible product is now Today, Train, Companion and Progress.
 *
 * The old Character/Battle implementation remains reachable only as a legacy
 * internal route so existing data and regression fixtures do not need a risky
 * destructive migration. It is intentionally absent from navigation.
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
import { createCompanionScreen } from './screens/companion.js'
import { clearActiveSessionDraft } from './session-draft.js'

const TABS = [
  { id: 'today', label: 'TODAY' },
  { id: 'train', label: 'TRAIN' },
  { id: 'companion', label: 'COMPANION' },
  { id: 'history', label: 'PROGRESS' },
]

const tabLabel = (id) => {
  if (id === 'character') return 'CHARACTER'
  return TABS.find((entry) => entry.id === id)?.label ?? 'SETTINGS'
}

export function createApp({ mount, workout, daily, planner, character, battle, maintenance, storage, clock, onSetup }) {
  const body = el('main.app__body', { 'aria-busy': 'false' })
  const overlays = el('div.app__overlays')
  const announcer = liveRegion()
  const tabBar = el('nav.tabbar', { 'aria-label': 'Sections' })
  const tabs = el('div.tabbar__tabs')
  const settingsAccess = el('button.settings-access', {
    type: 'button', 'aria-label': 'Settings', title: 'Settings',
    dataset: { active: 'false' }, onclick: () => toggleSettings(),
  }, [icon('gear')])

  let active = 'train'
  let returnTab = 'train'
  let settingsReturnTab = 'today'

  const train = createTrainScreen({ workout, storage, clock, onStart: (options) => startSession(options) })
  const history = createHistoryScreen({ storage, workout, daily, clock })
  const settings = createSettingsScreen({ storage, daily, workout, maintenance, onSetup })
  const companion = createCompanionScreen({ storage, clock, overlayHost: overlays })

  // Legacy RPG surfaces are kept out of navigation. Keeping the route alive is
  // deliberate: old stored battles/titles remain harmless and backups stay
  // backwards compatible while the product pivots away from game mechanics.
  const battleScreen = battle
    ? createBattleScreen({ battle, onClose: () => show(returnTab === 'settings' ? 'today' : returnTab) })
    : null
  const characterScreen = createCharacterScreen({
    character,
    onSettings: () => openSettings(),
    onBattle: battleScreen ? () => openBattle() : null,
  })

  const today = createTodayScreen({
    workout, daily, planner, clock,
    onStart: (options) => startSession(options),
    onOpenSlot: (slot) => slot?.extra
      ? startSession({ exerciseId: slot.exerciseId })
      : startSession({ slotTask: slot }),
  })

  const summary = createSummaryScreen({ onDone: async () => { await show(returnTab) } })
  let session = null
  const SCREENS = { today, train, companion, history, settings, character: characterScreen }

  function announce(text) {
    announcer.textContent = ''
    queueMicrotask(() => { announcer.textContent = text })
  }

  function openSettings() {
    if (active !== 'settings') {
      settingsReturnTab = TABS.some((entry) => entry.id === active) ? active : 'today'
    }
    return show('settings')
  }

  function toggleSettings() {
    return active === 'settings' ? show(settingsReturnTab) : openSettings()
  }

  function renderTabs(tab) {
    replace(tabs, TABS.map((entry) => el('button.tabbar__tab', {
      type: 'button',
      dataset: { tab: entry.id, active: String(tab === entry.id) },
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
    replace(body, [errorState({ title, detail, onRetry: retry, onBack: back })])
    body.scrollTop = 0
    announce(title)
  }

  async function openBattle() {
    if (!battleScreen) return
    returnTab = active === 'settings' ? 'today' : active
    body.setAttribute('aria-busy', 'true')
    try {
      await battleScreen.start()
      replace(body, [battleScreen.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Legacy battle')
    } catch (error) {
      console.error('[tempered] battle failed to start', error)
      showFailure({
        title: 'Battle could not open',
        detail: 'Nothing was lost. This legacy surface is no longer part of normal Tempered navigation.',
        retry: () => openBattle(),
        back: () => show('today'),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  function makeSessionScreen() {
    return createSessionScreen({
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
  }

  async function startSession(options) {
    returnTab = active === 'settings' ? 'today' : active
    session?.destroy()
    session = makeSessionScreen()

    body.setAttribute('aria-busy', 'true')
    try {
      await session.start({ ...(options ?? {}), returnTab })
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

  async function resumeSession(draft) {
    returnTab = ['today', 'train', 'companion', 'history', 'character'].includes(draft?.session?.returnTab)
      ? draft.session.returnTab
      : 'today'
    session?.destroy()
    session = makeSessionScreen()
    body.setAttribute('aria-busy', 'true')
    try {
      await session.resume(draft)
      replace(body, [session.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Workout session resumed')
    } catch (error) {
      console.error('[tempered] workout resume failed', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not resume',
        detail: 'Your checked sets are still saved. Retry, or discard the screen checkpoint and return to Today.',
        retry: () => resumeSession(draft),
        back: () => { clearActiveSessionDraft(); show('today') },
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function refreshScreen(tab) {
    if (tab === 'train') { await train.refresh(); replace(body, [train.root]); return }
    if (tab === 'history') { await history.refresh(); replace(body, [history.root]); return }
    if (tab === 'today') { await today.refresh(); replace(body, [today.root]); return }
    if (tab === 'companion') { await companion.refresh(); replace(body, [companion.root]); return }
    if (tab === 'settings') { await settings.refresh(); replace(body, [settings.root]); return }
    await characterScreen.refresh()
    replace(body, [characterScreen.root])
  }

  async function show(tab) {
    const visible = TABS.some((entry) => entry.id === tab)
    const target = tab === 'settings' || tab === 'character' || visible ? tab : 'today'
    if (target !== 'companion') companion.deactivate()
    active = target
    session?.destroy()
    session = null
    battleScreen?.destroy()
    tabBar.hidden = false
    settingsAccess.hidden = false
    const settingsActive = target === 'settings'
    settingsAccess.dataset.active = String(settingsActive)
    settingsAccess.setAttribute('aria-current', settingsActive ? 'page' : 'false')
    settingsAccess.setAttribute('aria-label', settingsActive ? 'Close Settings' : 'Settings')
    settingsAccess.title = settingsActive ? 'Close Settings' : 'Settings'
    renderTabs(target)

    body.setAttribute('aria-busy', 'true')
    try {
      await refreshScreen(target)
      renderTabs(target)
      body.scrollTop = 0
      announce(`${tabLabel(target).toLowerCase()} screen`)
      // Post-render integrations (notably the configurable Progress widgets)
      // need a deterministic signal after the new screen is actually mounted.
      // Observing shell mutations alone can race the asynchronous refresh and
      // leave an enhancement dormant until the user taps another control.
      window.dispatchEvent(new CustomEvent('tempered:screen-shown', {
        detail: { tab: target },
      }))
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

  replace(mount, [body, announcer, settingsAccess, tabBar, overlays])
  return { show, startSession, resumeSession }
}
