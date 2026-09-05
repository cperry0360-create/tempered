/**
 * The shell: four tabs, global Settings access, and immersive workout/battle
 * flows that temporarily take over.
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

export function createApp({ mount, workout, daily, character, battle, maintenance, storage, clock, onSetup }) {
  const body = el('main.app__body')
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
  const settings = createSettingsScreen({ storage, daily, maintenance, onSetup })
  const battleScreen = battle
    ? createBattleScreen({ battle, onClose: () => show(returnTab === 'settings' ? 'character' : returnTab) })
    : null

  const characterScreen = createCharacterScreen({
    character,
    onSettings: () => show('settings'),
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
    onOpenSlot: (slot) => startSession({ slotTask: slot }),
  })

  const summary = createSummaryScreen({ onDone: async () => { await show(returnTab) } })
  let session = null
  const SCREENS = { today, train, history, settings, character: characterScreen }

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

    const primary = SCREENS[tab]?.primary?.() ?? null
    replace(tabBar, [tabs, primary && el('button.fab', {
      type: 'button', 'aria-label': primary.label, title: primary.label,
      dataset: { ...(primary.dataset ?? {}), acid: 'primary' },
      onclick: primary.run,
    }, [icon(primary.icon ?? 'play')])])

    body.scrollTop = 0
  }

  replace(mount, [body, settingsAccess, tabBar])
  return { show, startSession }
}
