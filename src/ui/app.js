/**
 * The app shell. The visible product is now Today, Train, Fuel and Progress.
 *
 * The old Character/Battle implementation remains reachable only as a legacy
 * internal route so existing data and regression fixtures do not need a risky
 * destructive migration. It is intentionally absent from navigation.
 */

import { el, replace } from '../ui/dom.js'
import { errorState, liveRegion } from './states.js'
import { clock as formatClock } from './format.js'
import { icon } from './icons.js'
import { createTrainScreen } from './screens/train.js'
import { createSessionScreen } from './screens/session.js'
import { createSummaryScreen } from './screens/summary.js'
import { createHistoryScreen } from './screens/history.js'
import { createTodayScreen } from './screens/today.js'
import { createSettingsScreen } from './screens/settings.js'
import { createFuelScreen } from './screens/fuel.js'
import { createFuelNextScreen } from './screens/fuel-next.js'
import { createProgramBuilderScreen } from './screens/program-builder.js'
import { clearActiveSessionDraft, loadActiveSessionDraft } from './session-draft.js'

const TABS = [
  { id: 'today', label: 'Today', icon: 'calendar' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'fuel', label: 'Fuel', icon: 'food' },
  { id: 'history', label: 'Progress', icon: 'chart' },
]

const tabLabel = (id) => {
  if (id === 'character') return 'Character'
  return TABS.find((entry) => entry.id === id)?.label ?? 'Settings'
}

const LEGACY_STYLES = ['battle.css', 'expedition.css', 'battle-fidelity.css', 'character.css']

function loadLegacyStyles() {
  return Promise.all(LEGACY_STYLES.map((file) => new Promise((resolve, reject) => {
    const href = new URL(`../${file}`, import.meta.url).href
    const existing = [...document.styleSheets].find((sheet) => sheet.href === href)
    if (existing) { resolve(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Could not load legacy stylesheet: ${file}`))
    document.head.append(link)
  })))
}

export function createApp({ mount, workout, daily, planner, maintenance, storage, clock, appearance, loadLegacy, onSetup }) {
  const body = el('main.app__body', { 'aria-busy': 'false' })
  const overlays = el('div.app__overlays')
  const announcer = liveRegion()
  const tabBar = el('nav.tabbar', { 'aria-label': 'Sections' })
  const workoutDock = el('aside.active-workout-dock', { hidden: true })
  const cardioLayer = el('div.screen.screen--cardio', { hidden: true })
  const tabs = el('div.tabbar__tabs')

  let active = 'train'
  let returnTab = 'train'
  let navigationToken = 0
  let railGesture = null
  let railTimer = null
  let builder = null
  const openBuilder = async () => show('program-builder')
  const openProgramLibrary = async () => {
    await show('settings')
    const section = body.querySelector('[data-section="program-library"]')
    section?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  const train = createTrainScreen({
    workout, storage, clock,
    onStart: (options) => startSession(options),
    onStartCardio: () => launchQuickCardio(),
    onProgramBuilder: openBuilder,
    onProgramLibrary: openProgramLibrary,
  })
  const history = createHistoryScreen({ storage, workout, daily, clock })
  const settings = createSettingsScreen({ storage, daily, workout, maintenance, clock, appearance, onSetup, onProgramBuilder: openBuilder })
  // Approved Food 2.0 is now the default. ?food2=0 restores the original Food screen.
  // Both versions use the same canonical stores; this does not migrate or overwrite food data.
  const food2Enabled = new URLSearchParams(window.location.search).get('food2') !== '0'
  const fuel = food2Enabled
    ? createFuelNextScreen({ storage, daily, clock })
    : createFuelScreen({ storage, daily, clock })
  builder = createProgramBuilderScreen({ mount: body, storage, clock, workout, onClose: () => show('settings') })

  let battleScreen = null
  let characterScreen = null
  let legacyUiPromise = null

  async function ensureLegacy() {
    if (!legacyUiPromise) legacyUiPromise = (async () => {
      if (typeof loadLegacy !== 'function') throw new Error('Legacy screens are unavailable')
      const [services, characterModule, battleModule] = await Promise.all([
        loadLegacy(), import('./screens/character.js'), import('./screens/battle.js'),
        import('./battle-fx-runtime.js'), loadLegacyStyles(),
      ])
      battleScreen = battleModule.createBattleScreen({
        battle: services.battle,
        onClose: () => show(returnTab === 'settings' ? 'today' : returnTab),
      })
      characterScreen = characterModule.createCharacterScreen({
        character: services.character,
        onSettings: () => openSettings(),
        onBattle: () => openBattle(),
      })
    })()
    await legacyUiPromise
  }

  const today = createTodayScreen({
    workout, daily, planner, storage, clock,
    onStart: (options) => startSession(options),
    onStartCardio: () => launchQuickCardio(),
    onOpenSlot: (slot) => slot?.extra
      ? startSession({ exerciseId: slot.exerciseId })
      : startSession({ slotTask: slot }),
    onSettings: () => openSettings(),
    onViewSummary: () => show('history'),
  })

  const summary = createSummaryScreen({
    storage,
    onDone: async () => { await show(returnTab) },
  })
  let session = null

  // Ten-minute cardio is independent of lifting, and only explicit Save logs
  // minutes to Today. The checkpoint survives tab changes and an iOS reload.
  const CARDIO_KEY = 'tempered.quickCardio.v1'
  const CARDIO_SECONDS = 600
  let cardio = null
  let cardioSaving = false
  let cardioReturnTab = 'train'
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(CARDIO_KEY) ?? 'null')
    if (saved && Number.isFinite(saved.elapsedSec)
      && saved.elapsedSec >= 0 && saved.elapsedSec <= CARDIO_SECONDS
      && typeof saved.startedAt === 'number'
      && typeof saved.paused === 'boolean'
      && saved.createdAt > clock.now() - 86400000) cardio = saved
  } catch { /* No local storage in private mode. Timer still works in memory. */ }

  function cardioElapsed() {
    if (!cardio) return 0
    const active = cardio.paused ? 0 : Math.max(0, (clock.now() - cardio.startedAt) / 1000)
    return Math.min(CARDIO_SECONDS, Math.max(0, cardio.elapsedSec + active))
  }

  function checkpointCardio() {
    try {
      if (cardio) globalThis.localStorage?.setItem(CARDIO_KEY, JSON.stringify(cardio))
      else globalThis.localStorage?.removeItem(CARDIO_KEY)
    } catch { /* No persistent storage available. */ }
  }

  function pauseCardio() {
    if (!cardio || cardio.paused) return
    cardio.elapsedSec = cardioElapsed()
    cardio.paused = true
    checkpointCardio()
  }

  function cardioLabel() {
    const left = Math.max(0, CARDIO_SECONDS - cardioElapsed())
    return formatClock(Math.ceil(left))
  }

  function cardioMinutes() {
    // Keep real elapsed minutes, including a short session ended early.
    return Math.min(10, Math.round(cardioElapsed() / 60 * 100) / 100)
  }

  async function leaveCardio() {
    cardioLayer.hidden = true
    if (session?.root) {
      replace(body, [session.root])
      tabBar.hidden = true
      body.scrollTop = 0
      return
    }
    await show(cardioReturnTab)
  }

  function renderCardio() {
    if (!cardio) { replace(cardioLayer, []); return }
    const elapsed = cardioElapsed()
    const complete = elapsed >= CARDIO_SECONDS
    const minutes = cardioMinutes()
    const target = cardio.target
    replace(cardioLayer, [
      el('header.cardio-r5__header', {}, [
        el('button.cardio-r5__back', { type: 'button', dataset: { action: 'cancel-cardio' },
          disabled: cardioSaving, onclick: async () => {
            cardio = null; checkpointCardio(); await leaveCardio()
          } }, ['← Back']),
        el('span', { text: 'TEMPERED · CARDIO SESSION' }),
        el('span.cardio-r5__header-time', { text: '10 MIN' }),
      ]),
      el('div.cardio-r5__workspace', {}, [
        el('section.cardio-r5__stage', {}, [
          el('span.cardio-r5__eyebrow', { text: 'TODAY’S FINISHER' }),
          el('div.cardio-r5__stage-icon', {}, [icon('train')]),
          el('h1', { text: 'Easy cardio. Strong finish.' }),
          el('p', { text: 'Incline walking, cycling, or a comfortable stair step. Settle into a pace you can sustain while speaking in full sentences.' }),
          target && el('div.cardio-r5__target', { dataset: { cardioTarget: 'true' } }, [
            el('span', { text: 'PERSONAL ESTIMATED ZONE 2' }),
            el('strong', { text: `${target.lowBpm}–${target.highBpm} bpm` }),
            el('small', { text: 'Heart rate is a guide; the talk test comes first.' }),
          ]),
        ]),
        el('section.cardio-r5__logger', { dataset: { cardioSession: 'true' } }, [
          el('span.cardio-r5__eyebrow', { text: complete ? 'SESSION COMPLETE' : cardio.paused ? 'TIMER PAUSED' : 'IN PROGRESS' }),
          el('h2', { text: '10-minute Zone 2' }),
          el('p.cardio-r5__subtitle', { text: 'Continuous cardio · no lifting sets' }),
          el('div.cardio-r5__countdown', {
            dataset: { cardioCountdown: 'true' }, role: 'timer', 'aria-live': 'off', text: cardioLabel(),
          }),
          el('div.cardio-r5__progress', { role: 'progressbar', 'aria-label': 'Cardio time completed', 'aria-valuemin':'0',
            'aria-valuemax':'600', 'aria-valuenow':String(Math.floor(elapsed)) }, [
            el('span', { dataset: { cardioProgress: 'true' }, style: `width:${Math.round(elapsed / CARDIO_SECONDS * 100)}%` }),
          ]),
          el('p.cardio-r5__elapsed', { dataset: { cardioElapsed: 'true' },
            text: `${minutes.toFixed(2)} minutes completed · log any amount` }),
          el('div.cardio-r5__actions', {}, [
            !complete && el('button.cardio-r5__pause', { type: 'button', dataset: { action: 'toggle-cardio-pause' },
              onclick: () => {
                if (cardio.paused) { cardio.startedAt = clock.now(); cardio.paused = false; checkpointCardio() }
                else pauseCardio()
                renderCardio()
              } }, [cardio.paused ? 'Resume' : 'Pause']),
            el('button.cardio-r5__save', {
              type:'button', dataset: { action: 'save-cardio' }, disabled: cardioSaving || elapsed < 1,
              onclick: async () => {
                if (!cardio || cardioSaving) return
                pauseCardio()
                const actual = cardioMinutes()
                if (actual <= 0) return
                cardioSaving = true
                renderCardio()
                try {
                  await daily.log('micro_cardio', actual)
                  cardio = null
                  checkpointCardio()
                  await leaveCardio()
                  announce(`Saved ${actual.toFixed(2)} minutes of cardio`)
                } catch(error) {
                  console.error('[tempered] cardio save failed',error)
                  const message = cardioLayer.querySelector('[data-cardio-error]')
                  if (message) message.textContent = 'Could not save. Your timer is preserved; try again.'
                } finally { cardioSaving=false; if(cardio)renderCardio() }
              },
            }, [cardioSaving ? 'Saving…' : 'Finish & log']),
          ]),
          el('p.cardio-r5__status', { dataset: { cardioError: 'true' }, role:'status', text:'' }),
          el('p.cardio-r5__note', { text: 'You can finish early. Actual completed time goes to your Micro cardio log. Your strength workout remains intact.' }),
        ]),
      ]),
    ])
  }

  async function launchQuickCardio() {
    cardioReturnTab = active
    if (!cardio) {
      const target = (await workout.activeProgram())?.program?.cardioTarget ?? null
      cardio = { createdAt: clock.now(), startedAt: clock.now(), elapsedSec: 0, paused: false, target }
      checkpointCardio()
    }
    renderCardio()
    cardioLayer.hidden = false
    replace(body, [cardioLayer])
    tabBar.hidden = true
    body.scrollTop = 0
    announce('Cardio session started')
  }

  const cardioTicker = setInterval(() => {
    if (!cardio || !cardioLayer.isConnected) return
    const elapsed = cardioElapsed()
    const remaining = cardioLayer.querySelector('[data-cardio-countdown]')
    if (remaining) remaining.textContent = cardioLabel()
    const fill = cardioLayer.querySelector('[data-cardio-progress]')
    if (fill) fill.style.width = `${Math.round(elapsed / CARDIO_SECONDS * 100)}%`
    const progress = cardioLayer.querySelector('[role="progressbar"]')
    progress?.setAttribute('aria-valuenow', String(Math.floor(elapsed)))
    const elapsedCopy = cardioLayer.querySelector('[data-cardio-elapsed]')
    if (elapsedCopy) elapsedCopy.textContent = `${cardioMinutes().toFixed(2)} minutes completed · log any amount`
    const save = cardioLayer.querySelector('[data-action="save-cardio"]')
    if (save && !cardioSaving) {
      save.disabled = elapsed < 1
      save.textContent = 'Finish & log'
    }
    if (elapsed >= CARDIO_SECONDS && !cardio.paused) {
      pauseCardio()
      renderCardio()
    }
  }, 1000)
  renderCardio()

  function announce(text) {
    announcer.textContent = ''
    queueMicrotask(() => { announcer.textContent = text })
  }

  function renderWorkoutDock() {
    const draft = session ? null : loadActiveSessionDraft()
    if (!draft) {
      workoutDock.hidden = true
      replace(workoutDock, [])
      return
    }
    const elapsed = formatClock(Number(draft.elapsedSec) || 0)
    const paused = draft.timerPaused === true
    workoutDock.hidden = false
    replace(workoutDock, [el('button.active-workout-dock__button', {
      type: 'button', dataset: { activeWorkout: 'true' },
      'aria-label': `${paused ? 'Open paused' : 'Resume'} ${draft.session.title ?? 'workout'}`,
      onclick: () => {
        const current = loadActiveSessionDraft()
        if (current) resumeSession(current)
        else renderWorkoutDock()
      },
    }, [
      el('span.active-workout-dock__copy', {}, [
        el('strong', { text: `${draft.session.title ?? 'Workout'} · ${elapsed}${paused ? ' · Paused' : ''}` }),
      ]),
      el('span.active-workout-dock__resume', { text: paused ? 'Open' : 'Resume' }),
    ])])
  }

  function openSettings() {
    return show('settings')
  }


  // Keep navigation nodes stable. Rebuilding four expensive blurred surfaces
  // twice per navigation caused the white flash seen in Duo recordings.
  function renderTabs(tab) {
    if (!tabs.childElementCount) {
      replace(tabs, TABS.map((entry) => el('button.tabbar__tab', {
        type: 'button',
        dataset: { tab: entry.id, active: 'false', label: entry.label },
        'aria-label': `${entry.label.toLowerCase()} section`,
        onclick: () => show(entry.id),
      }, [icon(entry.icon), el('span', { text: entry.label })])))
      replace(tabBar, [tabs])
      installRailGesture()
    }
    for (const button of tabs.querySelectorAll('.tabbar__tab')) {
      const selected = button.dataset.tab === tab
      button.dataset.active = String(selected)
      if (selected) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
  }

  function installRailGesture() {
    // A touch-and-hold expands the label on the left; sliding up/down selects
    // another icon. The release activates it. Plain taps and keyboard clicks
    // continue to work normally, including automated .click() tests.
    const clearPreview = () => {
      clearTimeout(railTimer);railTimer=null
      tabs.removeAttribute('data-holding')
      for(const button of tabs.children)button.removeAttribute('data-peek')
    }
    const choose = y => {
      let nearest=null, distance=Infinity
      for(const button of tabs.querySelectorAll('.tabbar__tab')){
        const r=button.getBoundingClientRect()
        const d=Math.abs(y-(r.top+r.height/2))
        if(d<distance){nearest=button;distance=d}
      }
      for(const button of tabs.children) {
        if(button===nearest)button.dataset.peek='true'
        else button.removeAttribute('data-peek')
      }
      return nearest
    }
    tabs.addEventListener('pointerdown',event=>{
      const button=event.target.closest?.('.tabbar__tab')
      if(!button||event.button>0)return
      clearPreview()
      railGesture={id:event.pointerId,tab:button.dataset.tab,startY:event.clientY,selected:button.dataset.tab}
      tabs.setPointerCapture?.(event.pointerId)
      railTimer=setTimeout(()=>{
        if(!railGesture)return
        tabs.dataset.holding='true'
        choose(railGesture.startY)
      },270)
    })
    tabs.addEventListener('pointermove',event=>{
      if(!railGesture||event.pointerId!==railGesture.id)return
      if(Math.abs(event.clientY-railGesture.startY)>8){
        clearTimeout(railTimer)
        tabs.dataset.holding='true'
        const chosen=choose(event.clientY)
        if(chosen)railGesture.selected=chosen.dataset.tab
      }
    })
    const end=event=>{
      if(!railGesture||event.pointerId!==railGesture.id)return
      const selected=railGesture.selected
      const cancelled=event.type==='pointercancel'
      railGesture=null;clearPreview()
      if(!cancelled)show(selected)
    }
    tabs.addEventListener('pointerup',end)
    tabs.addEventListener('pointercancel',end)
  }

  function showFailure({ title, detail, retry, back }) {
    tabBar.hidden = false
    replace(body, [errorState({ title, detail, onRetry: retry, onBack: back })])
    body.scrollTop = 0
    announce(title)
  }

  async function openBattle() {
    returnTab = active === 'settings' ? 'today' : active
    body.setAttribute('aria-busy', 'true')
    try {
      await ensureLegacy()
      await battleScreen.start()
      replace(body, [battleScreen.root])
      tabBar.hidden = true
      body.scrollTop = 0
      announce('Legacy battle')
    } catch (error) {
      console.error('[tempered] battle failed to start', error)
      showFailure({
        title: 'Battle could not open',
        detail: 'Nothing was lost; this legacy surface is outside normal Tempered navigation.',
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
      onStartCardio: () => launchQuickCardio(),
      onMinimize: async () => {
        const open = session
        session = null
        open?.destroy()
        await show('today')
      },
      onFinish: async (result) => {
        session?.destroy()
        session = null
        if (!result) { await show(returnTab); return }
        await summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        body.scrollTop = 0
        announce('Workout summary')
        renderWorkoutDock()
      },
    })
  }

  async function startSession(options) {
    // Starting another session must not overwrite a minimized workout draft.
    const existingDraft = loadActiveSessionDraft()
    if (!session && existingDraft?.minimized === true) return resumeSession(existingDraft)
    returnTab = active === 'settings' ? 'today' : active
    session?.destroy()
    session = makeSessionScreen()
    renderWorkoutDock()

    body.setAttribute('aria-busy', 'true')
    try {
      await session.start({ ...(options ?? {}), returnTab })
      replace(body, [session.root])
      tabBar.hidden = true
      body.scrollTop = 0
      announce('Workout session')
      renderWorkoutDock()
    } catch (error) {
      console.error('[tempered] session failed to start', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not open',
        detail: 'Nothing was logged or removed; try again or return to where you were.',
        retry: () => startSession(options),
        back: () => show(returnTab),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function resumeSession(draft) {
    const savedReturn = draft?.session?.returnTab
    returnTab = ['today', 'train', 'fuel', 'history', 'character'].includes(savedReturn)
      ? savedReturn
      : 'today'
    session?.destroy()
    session = makeSessionScreen()
    renderWorkoutDock()
    body.setAttribute('aria-busy', 'true')
    try {
      await session.resume(draft)
      replace(body, [session.root])
      tabBar.hidden = true
      body.scrollTop = 0
      announce('Workout session resumed')
      renderWorkoutDock()
    } catch (error) {
      console.error('[tempered] workout resume failed', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not resume',
        detail: 'Your checked sets are still saved; retry or discard the screen checkpoint and return to Today.',
        retry: () => resumeSession(draft),
        back: () => { clearActiveSessionDraft(); show('today') },
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function refreshScreen(tab,isCurrent=()=>true) {
    if (tab === 'train') { await train.refresh(); if(isCurrent())replace(body, [train.root]); return }
    if (tab === 'history') { await history.refresh(); if(isCurrent())replace(body, [history.root]); return }
    if (tab === 'today') { await today.refresh(); if(isCurrent())replace(body, [today.root]); return }
    if (tab === 'fuel') { await fuel.refresh(); if(isCurrent())replace(body, [fuel.root]); return }
    if (tab === 'settings') { await settings.refresh(); if(isCurrent())replace(body, [settings.root]); return }
    if (tab === 'program-builder') { await builder.start(); return }
    await ensureLegacy()
    await characterScreen.refresh()
    if(isCurrent())replace(body, [characterScreen.root])
  }

  async function show(tab) {
    const requested = tab
    const visible = TABS.some((entry) => entry.id === requested)
    const target = requested === 'settings' || requested === 'character'
      || requested === 'program-builder' || visible ? requested : 'today'
    const token = ++navigationToken
    if (target !== 'fuel') fuel.deactivate()
    if (target !== 'today') today.deactivate?.()
    active = target
    session?.destroy()
    session = null
    battleScreen?.destroy()
    tabBar.hidden = false
    if (target === 'program-builder') tabBar.hidden = true
    renderTabs(target)

    body.setAttribute('aria-busy', 'true')
    try {
      await refreshScreen(target,()=>token===navigationToken)
      if(token!==navigationToken)return
      renderWorkoutDock()
      body.scrollTop = 0
      announce(`${tabLabel(target).toLowerCase()} screen`)
      // Post-render integrations need a deterministic signal after the new
      // screen is mounted; shell mutations can race the asynchronous refresh.
      window.dispatchEvent(new CustomEvent('tempered:screen-shown', {
        detail: { tab: target },
      }))
    } catch (error) {
      if(token!==navigationToken)return
      console.error(`[tempered] ${target} failed to load`, error)
      showFailure({
        title: `${tabLabel(target)} could not load`,
        detail: 'Your saved data was not changed; try this screen again.',
        retry: () => show(target),
        back: target === 'today' ? null : () => show('today'),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function showTodayDate(date) {
    await show('today')
    await today.showDate(date)
    body.scrollTop = 0
    announce(`${date} day review`)
  }

  replace(mount, [body, announcer, workoutDock, tabBar, overlays])
  return { show, showTodayDate, startSession, resumeSession, launchQuickCardio }
}
