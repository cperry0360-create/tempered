/**
 * The active workout — the centre of the app.
 *
 * Re-implemented against the rewritten `docs/04-design-system.md`, which
 * supersedes section F of `docs/09-tracker-v2.md`. Everything docs/09 asked for
 * functionally is unchanged; how it reads at arm's length is not:
 *
 *   - the exercise name is a section heading, not a label: 28px, weight 800
 *   - each field is its own rounded outlined cell. The set being worked gets an
 *     olive fill and a 4px acid bar down its left edge
 *   - completed rows keep full text brightness. The check carries the state,
 *     because those numbers are what you read to choose the next weight
 *   - exercise actions are visible round pills in a scroller. Never a menu
 *   - no hairline separates any two rows. Surface and space do that work
 *   - acid marks three things only: the set being worked, the column being
 *     logged, and a value worth noticing. Every one of them carries
 *     `data-acid`, which is the only way this stylesheet paints acid at all
 *
 * The plate calculator now sits in the row being worked, beside its weight
 * field, which is what `docs/09` section C asked for — it was previously at the
 * foot of the card, a screen away from the number it describes.
 */

import { el, replace } from '../dom.js'
import { openPlateCalculator } from '../plate-calculator.js'
import { customExerciseForm } from '../custom-exercise-form.js'
import { icon } from '../icons.js'
import { lbs, performance, clock, since, shortDate } from '../format.js'
import { solvePlates } from '../../domain/plates.js'
import { methodForExercise, methodsForExercise } from '../../domain/exercise-method.js'
import { clearActiveSessionDraft, loadActiveSessionDraft, saveActiveSessionDraft } from '../session-draft.js'

/** Art lives beside the repo root; resolve against this module so the path holds
 *  wherever the document lives — the app root, /tempered/, or a test harness. */
const artUrl = (file) => new URL(`../../../art/exercises/${file}`, import.meta.url).href
const stretchPhotos = {
  Straight: new URL('../stretch-photos/foot-calf-straight.jpg', import.meta.url).href,
  Bent: new URL('../stretch-photos/foot-calf-bent.jpg', import.meta.url).href,
}

/** What a home gym holds, per side. Editable from the Equipment pill. */
const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25]

const activeMethod = (entry) => methodForExercise(entry?.exercise, entry?.method)

/** A plate calculator is only meaningful when this movement is using a bar. */
const isBarbell = (entry) => activeMethod(entry) === 'Barbell' && entry?.exercise?.unit !== 'time'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(summary: object|null) => void} deps.onFinish  `null` when nothing was logged.
 * @param {() => void} deps.onMinimize Preserve the draft and return to Tempered.
 */
export function createSessionScreen({ workout, clock: timeSource, onFinish, onMinimize, onStartCardio }) {
  const root = el('div.screen.screen--session')

  /** @type {any} */ let session = null
  /** @type {any[]} */ let plan = []
  /** Sets logged in THIS screen, so settling a shared day session scores only
   *  the work just done rather than everything already logged today. */
  /** @type {any[]} */ let loggedHere = []
  let isFirstOfDay = true
  /** @type {any[]} */ let library = []
  /** @type {{exerciseId: string, endsAt: number}|null} */ let rest = null
  /** @type {string|null} */ let openPanel = null   // `${exerciseId}:${panel}`
  let confirmingFinish = false
  let addingMovement = false
  let addQuery = ''
  let stretch = null
  let hold = null
  let savingStretch = false
  let stretchError = ''
  let ticker
  let elapsedSec = 0
  let activeSince = null
  let timerPaused = false
  let timerPauseUsed = false
  let wakeLock = null
  let hasUnloggedEdits = false
  let confirmingDiscard = false
  let discardingWorkout = false
  let discardFailure = ''
  let halfFold = false
  let halfFoldIndex = 0
  let focusStageIndex = 0
  // Display-only choice. Never affects saved set data or session drafts.
  const PROGRESS_VIEW_KEY = 'lfms.session.progress-style'
  const savedProgressView = () => {
    try {
      const value = globalThis.localStorage?.getItem(PROGRESS_VIEW_KEY)
      return ['focus','cards','matrix'].includes(value) ? value : 'focus'
    } catch { return 'focus' }
  }
  let progressView = savedProgressView()
  let artViewer = null
  let weightWarningDialog = null
  let loggingSet = false

  // Rest is a real dock row inside the unfolded Duo exercise column.
  const isInlineRestDock = () => document.documentElement.dataset.layout === 'duo'
    && !halfFold && window.matchMedia('(min-width:740px) and (orientation:landscape)').matches
  function syncHalfFoldViewport() {
    if (!halfFold) return
    const viewport = window.visualViewport
    const visibleBottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight
    root.style.setProperty('--half-fold-visible-height', `${Math.max(1, visibleBottom - root.getBoundingClientRect().top)}px`)
  }
  window.visualViewport?.addEventListener('resize', syncHalfFoldViewport)
  window.visualViewport?.addEventListener('scroll', syncHalfFoldViewport)
  window.addEventListener('resize', syncHalfFoldViewport)

  function elapsedSeconds() {
    const active = activeSince === null ? 0 : Math.max(0, (timeSource.now() - activeSince) / 1000)
    return Math.max(0, elapsedSec + active)
  }

  function pauseElapsedTimer() {
    if (activeSince === null) return
    elapsedSec = elapsedSeconds()
    activeSince = null
  }

  function resumeElapsedTimer() {
    if (activeSince === null) activeSince = timeSource.now()
  }

  function tellNativeWorkoutActive(active) {
    try {
      window.webkit?.messageHandlers?.temperedWakeLock?.postMessage({ active })
    } catch { /* The browser wake lock remains available outside the wrapper. */ }
  }

  async function requestWorkoutWakeLock() {
    if (activeSince === null || document.visibilityState !== 'visible' || wakeLock) return
    try {
      wakeLock = await navigator.wakeLock?.request?.('screen') ?? null
      wakeLock?.addEventListener?.('release', () => { wakeLock = null }, { once: true })
    } catch { /* iOS may decline; the native wrapper has its own idle-timer bridge. */ }
  }

  function activateWorkoutScreen() {
    if (timerPaused || document.visibilityState === 'hidden') return
    resumeElapsedTimer()
    tellNativeWorkoutActive(true)
    requestWorkoutWakeLock()
  }

  function releaseWorkoutWakeLock() {
    tellNativeWorkoutActive(false)
    const held = wakeLock
    wakeLock = null
    held?.release?.().catch?.(() => {})
  }

  function toggleWorkoutTimer() {
    if (timerPaused) {
      timerPaused = false
      activateWorkoutScreen()
    } else {
      pauseElapsedTimer()
      timerPaused = true
      timerPauseUsed = true
      releaseWorkoutWakeLock()
      if (hold) pauseStretchHold()
    }
    persistDraft()
    render()
  }

  function persistDraft() {
    if (!session || stretch) return
    saveActiveSessionDraft({
      version: 1,
      session: { ...session },
      plan,
      loggedHereIds: loggedHere.map((log) => log.id),
      isFirstOfDay,
      rest,
      openPanel,
      hasUnloggedEdits,
      elapsedSec: elapsedSeconds(),
      timerPaused,
      timerPauseUsed,
      halfFold,
      halfFoldIndex,
      focusStageIndex,
    })
  }

  function checkpointWhenHidden() {
    if (document.visibilityState === 'hidden') {
      if (hold) pauseStretchHold()
      pauseElapsedTimer()
      persistDraft()
      releaseWorkoutWakeLock()
    } else {
      activateWorkoutScreen()
    }
  }
  function checkpointOnPageHide() {
    if (hold) pauseStretchHold()
    pauseElapsedTimer()
    persistDraft()
    releaseWorkoutWakeLock()
  }
  document.addEventListener('visibilitychange', checkpointWhenHidden)
  window.addEventListener('pagehide', checkpointOnPageHide)

  // Outside taps close the menu without replacing the tapped set input.
  function dismissExerciseMenu() {
    if (!openPanel?.endsWith(':menu')) return false
    openPanel = null
    root.querySelectorAll('.exercise-menu').forEach(node=>node.remove())
    root.querySelectorAll('.exercise-menu__trigger[aria-expanded="true"]').forEach(
      node=>node.setAttribute('aria-expanded','false'))
    persistDraft()
    return true
  }
  const onOutsideMenuPointer=(event)=>{
    if(!root.isConnected || !openPanel?.endsWith(':menu'))return
    if(!event.target.closest?.('.exercise-menu-wrap'))dismissExerciseMenu()
  }
  const onSessionKeydown=(event)=>{
    if(event.key!=='Escape'||!root.isConnected||weightWarningDialog?.open)return
    if(artViewer){closeExerciseArt();event.preventDefault();return}
    if(dismissExerciseMenu())event.preventDefault()
  }
  document.addEventListener('pointerdown',onOutsideMenuPointer,true)
  document.addEventListener('keydown',onSessionKeydown)
  const panelKey = (entry, name) => `${entry.exercise.id}:${name}`
  const isOpen = (entry, name) => openPanel === panelKey(entry, name)
  function togglePanel(entry, name) {
    openPanel = isOpen(entry, name) ? null : panelKey(entry, name)
    persistDraft()
    render()
  }

  // --- rest timer ----------------------------------------------------------

  function startRest(entry) {
    const durationSec = Math.max(0, Number(entry.restSec) || 0)
    rest = {
      exerciseId: entry.exercise.id,
      durationSec,
      endsAt: timeSource.now() + durationSec * 1000,
    }
    persistDraft()
    render()
    tick()
  }

  function adjustRest(seconds) {
    if (!rest) return
    rest.endsAt = Math.max(timeSource.now(), rest.endsAt + seconds * 1000)
    rest.durationSec = Math.max(1, (rest.durationSec ?? 1) + seconds)
    persistDraft()
    tick()
  }

  function skipRest() {
    if (!rest) return
    rest = null
    persistDraft()
    render()
  }

  function tick() {
    const elapsed = root.querySelector('[data-session-elapsed]')
    if (elapsed) elapsed.textContent = clock(elapsedSeconds())
    const stageClock=root.querySelector('[data-stage-clock]')
    if(stageClock)stageClock.textContent=clock(elapsedSeconds())
    if (hold?.endsAt != null) {
      const remaining = Math.max(0, hold.endsAt - timeSource.now())
      const display = root.querySelector('[data-stretch-countdown]')
      if (display) display.textContent = clock(Math.ceil(remaining / 1000))
      if (remaining === 0) {
        const { entry, index } = hold
        hold = null
        entry.sets[index].logged = true
        const next = plan.findIndex((item) => item.sets.some((set) => !set.logged))
        if (next < 0) render()
        else {
          focusStageIndex = next
          halfFoldIndex = next
          startRest(entry)
        }
        return
      }
    }
    if (!rest) return
    // The absolute end timestamp is canonical. Do not decrement a counter:
    // sleeping/backgrounding the screen must not pause or drift the timer.
    const remaining = Math.max(0, (Number(rest.endsAt) - timeSource.now()) / 1000)
    const node = document.querySelector('[data-session-rest-overlay] [data-rest-remaining]')
    if (node) node.textContent = `Rest ${clock(remaining)}`
    const progress = document.querySelector('[data-session-rest-overlay] [data-rest-progress]')
    if (progress) {
      const duration = Math.max(1, Number(rest.durationSec) || remaining || 1)
      progress.style.width = `${Math.max(0, Math.min(100, (remaining / duration) * 100))}%`
    }
    if (remaining <= 0) {
      rest = null
      persistDraft()
      render()
    }
  }
  ticker = setInterval(tick, 500)

  // --- fields --------------------------------------------------------------

  /** Which two numbers a set has. A carry has no reps; a hold has no load. */
  function fieldsFor(exercise) {
    if (exercise?.metric === 'distance') {
      return [{ key: 'weight', label: 'lb', mode: 'decimal' }, { key: 'distance', label: 'ft', mode: 'numeric' }]
    }
    if (exercise?.unit === 'time') return [{ key: 'timeSec', label: 'sec', mode: 'numeric' }, null]
    return [{ key: 'weight', label: 'lb', mode: 'decimal' }, { key: 'reps', label: 'Reps', mode: 'numeric' }]
  }

  function numberOrNull(value) {
    const parsed = Number.parseFloat(String(value).trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  /**
   * The column being logged is acid, the rest are `--text-3`.
   *
   * Done by hand rather than by re-rendering, because re-rendering on focus
   * would take the field out from under the thumb that just tapped it.
   */
  function markColumn(input, on) {
    const card = input.closest('[data-exercise]')
    const label = card?.querySelector(`.setrow--head [data-col="${input.dataset.field}"]`)
    if (!label) return
    if (on) label.dataset.acid = 'active'
    else delete label.dataset.acid
  }

  // --- the plate calculator, in the row it describes ------------------------

  function plateStrip(entry, set) {
    const solution = typeof set.weight === 'number'
      ? solvePlates(set.weight, { bar: entry.barWeight, plates: entry.plates })
      : null
    const plates = solution?.perSide?.length ? solution.perSide.join(' · ') : 'empty bar'
    return el('div.plates', { dataset: { plates: entry.exercise.id } }, [
      el('span.plates__label', {
        text: `Per side: ${plates} · ${entry.barWeight} lb bar`,
      }),
    ])
  }

  /**
   * Editing set 1 fills the rest of that exercise's unlogged sets — `docs/11` F2.
   *
   * The single biggest tap saving available: a prescription of four sets is one
   * weight typed four times otherwise. Only the first set cascades, because
   * that is the one that means "this is what I am doing today"; editing set
   * three is a correction to set three.
   *
   * **Already-logged sets are never touched.** They are what happened, and a
   * cascade that rewrote them would silently falsify history — and with it the
   * volume the XP was computed from.
   *
   * @param {any} entry
   * @param {string} key   'weight' | 'reps' | 'timeSec'
   * @param {number|null} value
   */
  function cascade(entry, key, value) {
    if (value === null) return
    for (const [index, other] of entry.sets.entries()) {
      if (index === 0 || other.logged === true) continue
      other[key] = value
      other.editedFields = { ...(other.editedFields ?? {}), [key]: true }
    }
  }

  function previousSet(entry, index) {
    return entry.last?.sets?.[index] ?? entry.last?.sets?.[0] ?? null
  }

  function previousValue(entry, index, key) {
    const previous = previousSet(entry, index)
    const value = previous?.[key]
    return Number.isFinite(Number(value)) ? Number(value) : null
  }

  function displayName(exercise, slot = null) {
    const raw = exercise?.name ?? exercise?.movementName ?? 'Exercise'
    const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/)
    let base = (slot?.name ?? exercise?.movementName ?? (match ? match[1] : raw)).trim()
    let suffix = match ? match[2].trim() : ''
    if (suffix && exercise?.variant) {
      suffix = suffix.replace(new RegExp(`\\b${exercise.variant}\\b[, ]*`, 'i'), '')
    }
    suffix = suffix.replace(/\bgrip\b/ig, '').replace(/\s*,\s*/g, ' · ').replace(/^[ ·-]+|[ ·-]+$/g, '').trim()
    const normalize = (value) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const baseKey = normalize(base)
    const suffixKey = normalize(suffix)
    // Program names sometimes already include the repeated equipment/variant
    // words in parentheses. Keep a genuinely distinguishing suffix such as
    // "Wide", but never append the base name (or one of its own words) twice.
    if (suffixKey && (` ${baseKey} `.includes(` ${suffixKey} `)
      || ` ${suffixKey} `.includes(` ${baseKey} `))) suffix = ''
    return suffix ? `${base} · ${suffix}` : base
  }

  function e1rm(weight, reps) {
    const w = Number(weight)
    const r = Number(reps)
    return Number.isFinite(w) && w > 0 && Number.isFinite(r) && r > 0 ? w * (1 + r / 30) : null
  }

  function isSetPr(entry, set) {
    if (!set.logged) return false
    const current = e1rm(set.weight, set.reps)
    const best = Number(entry.record?.bestE1RM?.value)
    return current !== null && Number.isFinite(best) && current > best
  }

  function setTypeKey(entry, index) {
    return `${entry.exercise.id}:settype:${index}`
  }

  async function removeSetAt(entry, index) {
    const set = entry.sets[index]
    if (!set) return
    if (set.logId) {
      await workout.removeSet(set.logId)
      loggedHere = loggedHere.filter((log) => log.id !== set.logId)
    }
    entry.sets.splice(index, 1)
    hasUnloggedEdits = true
    persistDraft()
    render()
  }

  function confirmWeightPr(entry, warning) {
    return new Promise((resolve) => {
      const dialog = el('dialog.confirm-sheet.weight-pr-warning', {
        'aria-labelledby': 'weight-pr-title', 'aria-describedby': 'weight-pr-copy',
        dataset: { weightPrWarning: 'true' },
      }, [
        el('h2.confirm-sheet__title', { id: 'weight-pr-title', text: 'Check this weight' }),
        el('p.confirm-sheet__copy', { id: 'weight-pr-copy',
          text: `${entry.exercise.name} at ${lbs(warning.weight)} lb is ${warning.percent}% above your ${lbs(warning.previous)} lb weight PR.` }),
        el('div.confirm-sheet__actions', {}, [
          el('button.button.confirm-sheet__keep', { type: 'button', autofocus: true,
            onclick: () => dialog.close('edit') }, ['Edit weight']),
          el('button.button', { type: 'button', dataset: { acid: 'secondary' },
            onclick: () => dialog.close('log') }, ['Log anyway']),
        ]),
      ])
      dialog.addEventListener('close', () => {
        dialog.remove()
        weightWarningDialog = null
        resolve(dialog.returnValue === 'log')
      }, { once: true })
      weightWarningDialog = dialog
      document.body.append(dialog)
      dialog.showModal()
    })
  }

  // --- set row -------------------------------------------------------------

  function setRow(entry, set, index) {
    const done = set.logged === true
    const active = !done && entry.sets.findIndex((candidate) => !candidate.logged) === index
    const previous = previousSet(entry, index)
    const fields = fieldsFor(entry.exercise)
    const inputs = fields.map((field) => {
      if (!field) return el('span.setrow__num')
      const current = set[field.key]
      return el('input.setrow__num', {
        type: 'text',
        inputmode: field.mode,
        value: current ?? '',
        placeholder: '',
        readOnly: done,
        'aria-label': `${field.label}, set ${index + 1}`,
        dataset: { field: field.key, exercise: entry.exercise.id, set: String(index) },
        oninput: (event) => {
          set[field.key] = numberOrNull(event.target.value)
          set.editedFields = { ...(set.editedFields ?? {}), [field.key]: true }
          hasUnloggedEdits = true
          persistDraft()
        },
        onfocus: (event) => markColumn(event.target, true),
        onblur: (event) => markColumn(event.target, false),
        onchange: (event) => {
          set[field.key] = numberOrNull(event.target.value)
          if (index === 0) cascade(entry, field.key, set[field.key])
          hasUnloggedEdits = true
          persistDraft()
          render()
        },
      })
    })

    const previousButton = isSetPr(entry, set)
      ? el('span.setrow__pr', { text: 'PR' })
      : el('button.setrow__record', {
          type: 'button',
          disabled: !previous,
          'aria-label': previous ? `Copy previous set ${index + 1}` : 'No previous set',
          onclick: () => {
            if (!previous || done) return
            for (const field of fields) {
              if (!field) continue
              const value = previousValue(entry, index, field.key)
              if (value !== null) {
                set[field.key] = value
                set.editedFields = { ...(set.editedFields ?? {}), [field.key]: true }
              }
            }
            hasUnloggedEdits = true
            persistDraft()
            render()
          },
          text: previous
            ? (Number.isInteger(previous.cablePeg)
                ? `P${previous.cablePeg} · ${performance(previous)}`
                : performance(previous))
            : '—',
        })

    const check = el('button.setrow__check', {
      type: 'button',
      'aria-label': done ? `Undo set ${index + 1}` : `Log set ${index + 1}`,
      dataset: { log: `${entry.exercise.id}:${index}`, done: String(done) },
      onpointerdown: (event) => {
        // Keep the input's change handler from replacing the button before click.
        if (document.activeElement?.matches('.setrow__num')) event.preventDefault()
      },
      onclick: async () => {
        if (loggingSet) return
        if (done) {
          const wasLatestLogged = entry.sets.findLastIndex((other) => other.logged === true) === index
          if (set.logId) {
            await workout.removeSet(set.logId)
            loggedHere = loggedHere.filter((log) => log.id !== set.logId)
          }
          set.logged = false
          set.logId = null
          if (wasLatestLogged && rest?.exerciseId === entry.exercise.id) rest = null
          persistDraft()
          render()
          return
        }

        // The progression prescription is already a real input value. One tap
        // logs exactly what is visible, unless the user edited it first.
        for (const input of inputs) {
          if (!input.dataset?.field) continue
          set[input.dataset.field] = numberOrNull(input.value)
        }
        const setType = set.setType ?? 'working'
        const logged = {
          exerciseId: entry.exercise.id,
          method: activeMethod(entry),
          weight: set.weight ?? null,
          reps: set.reps ?? null,
          timeSec: set.timeSec ?? null,
          distance: set.distance ?? null,
          isWarmup: setType === 'warmup',
          setType,
          perSide: set.perSide === true,
          substitutedFor: entry.substitutedFor ?? null,
          programDayId: entry.programDayId ?? null,
          slotIndex: entry.slotIndex ?? null,
          setIndex: index,
        }
        loggingSet = true
        const focused = document.activeElement
        if (focused?.matches('.setrow__num')) focused.blur()
        let log
        try {
          const warning = await workout.weightPrWarning(logged, loggedHere)
          if (warning && !(await confirmWeightPr(entry, warning))) {
            const weightInput = [...root.querySelectorAll('.setrow__num[data-field="weight"]')]
              .find((input) => input.dataset.exercise === entry.exercise.id && input.dataset.set === String(index))
            weightInput?.focus()
            weightInput?.select()
            return
          }
          if (!root.isConnected) return
          log = await workout.logSet(session, logged)
        } finally {
          loggingSet = false
        }
        loggedHere.push(log)
        set.logged = true
        set.logId = log.id
        const priorFocus = focusStageIndex
        focusStageIndex = Math.max(0, plan.indexOf(entry))
        if (entry.sets.every(s => s.logged) && focusStageIndex < plan.length-1) focusStageIndex += 1
        hasUnloggedEdits = false
        render()
        if (focusStageIndex !== priorFocus) requestAnimationFrame(() =>
          root.querySelector('.session-r5__log .exercise[data-focused="true"]')?.scrollIntoView({ behavior:'smooth', block:'start' }))
        startRest(entry)
      },
    }, [icon('check')])

    let touchStartX = null
    const row = el('div.setrow', {
      dataset: { done: String(done) },
      ontouchstart: (event) => { touchStartX = event.touches?.[0]?.clientX ?? null },
      ontouchend: (event) => {
        const endX = event.changedTouches?.[0]?.clientX
        if (touchStartX !== null && Number.isFinite(endX) && touchStartX - endX > 64) removeSetAt(entry, index)
        touchStartX = null
      },
    }, [
      el('button.setrow__index', {
        type: 'button',
        'aria-label': `Set ${index + 1} type`,
        onclick: () => {
          openPanel = openPanel === setTypeKey(entry, index) ? null : setTypeKey(entry, index)
          render()
        },
        text: set.setType === 'warmup' ? 'W' : set.setType === 'drop' ? 'D' : set.setType === 'failset' ? 'F' : String(index + 1),
      }),
      previousButton,
      ...inputs,
      check,
    ])

    if (openPanel === setTypeKey(entry, index)) {
      row.append(el('div.settype', {}, [
        ['working', 'Working'], ['warmup', 'Warm-up (W)'], ['drop', 'Drop (D)'], ['failset', 'Failure (F)'],
      ].map(([value, label]) => el('button.settype__option', {
        type: 'button',
        dataset: { selected: String((set.setType ?? 'working') === value) },
        onclick: () => {
          set.setType = value
          openPanel = null
          hasUnloggedEdits = true
          persistDraft()
          render()
        },
      }, [label]))))
    }
    return el('div.setrow-wrap', {}, [
      row,
      active && isBarbell(entry) ? plateStrip(entry, set) : null,
    ])
  }

  // --- panels --------------------------------------------------------------

  function equipmentPanel(entry) {
    return el('div.panel', {}, [
      el('p.panel__note', { text: 'The loading beside the weight uses the bar and plates you have.' }),
      el('div.equipment', {}, [
        el('label.equipment__row', {}, [
          el('span.equipment__label', { text: 'Bar' }),
          el('input.equipment__bar', {
            type: 'text', inputmode: 'decimal', value: String(entry.barWeight),
            'aria-label': 'Bar weight',
            dataset: { barweight: entry.exercise.id },
            onchange: (event) => { entry.barWeight = numberOrNull(event.target.value) ?? 45; persistDraft(); render() },
          }),
        ]),
        el('div.equipment__row', {}, [
          el('span.equipment__label', { text: 'Plates' }),
          ...DEFAULT_PLATES.map((plate) => el('button.equipment__plate', {
            type: 'button',
            'aria-pressed': String(entry.plates.includes(plate)),
            dataset: { plateon: String(entry.plates.includes(plate)), plateoption: String(plate) },
            onclick: () => {
              entry.plates = entry.plates.includes(plate)
                ? entry.plates.filter((p) => p !== plate)
                : [...entry.plates, plate].sort((a, b) => b - a)
              persistDraft()
              render()
            },
          }, [String(plate)])),
        ]),
      ]),
    ])
  }

  function historyPanel(entry) {
    if (!entry.history) return el('div.panel', {}, [el('p.panel__note', { text: 'Loading…' })])
    if (entry.history.length === 0) {
      return el('div.panel', {}, [
        el('p.panel__note', { text: `No ${activeMethod(entry).toLowerCase()} history for this movement yet.` }),
      ])
    }
    return el('div.panel', {}, entry.history.map((day) => el('div.historyline', {}, [
      el('span.historyline__date', { text: shortDate(day.date) }),
      el('span.historyline__sets', {
        text: day.sets.map((s) => performance(s)).join('   '),
      }),
    ])))
  }

  function methodPanel(entry) {
    const current = activeMethod(entry)
    const locked = entry.sets.some((set) => set.logged === true)
    return el('div.panel', {}, [
      el('p.panel__note', {
        text: locked
          ? 'Undo the checked sets before changing method; logged work keeps the equipment it used.'
          : 'Keep the same movement and program slot while changing the equipment and load history.',
      }),
      el('div.methodlist', { role: 'group', 'aria-label': 'Exercise method' },
        methodsForExercise(entry.exercise).map((method) => el('button.methodlist__option', {
          type: 'button',
          disabled: locked,
          'aria-pressed': String(method === current),
          dataset: { methodchoice: method, selected: String(method === current) },
          onclick: async () => {
            if (locked || method === current) {
              if (method === current) togglePanel(entry, 'method')
              return
            }
            const performanceForMethod = await workout.methodPerformance(entry.exercise.id, method)
            entry.method = method
            entry.last = performanceForMethod.last
            entry.record = performanceForMethod.record
            entry.history = null
            entry.proposal = {
              ...(entry.proposal ?? {}),
              reason: entry.last
                ? `Prefilled from your last ${method.toLowerCase()} session.`
                : `No ${method.toLowerCase()} history yet; your rep target stays the same.`,
            }
            entry.sets = entry.sets.map((set, index) => ({
              ...set,
              weight: entry.last?.sets?.[index]?.weight ?? entry.last?.sets?.[0]?.weight ?? null,
            }))
            openPanel = null
            persistDraft()
            render()
          },
        }, [method])),
      ),
    ])
  }

  function swapPanel(entry) {
    return el('div.panel', {}, [
      el('p.panel__note', { text: 'Swap in another movement while keeping your set structure.' }),
      el('div.swaplist', {}, library
        .filter((exercise) => exercise.id !== entry.exercise.id)
        .sort((a, b) => Number(b.id === entry.slot?.substituteExerciseId) - Number(a.id === entry.slot?.substituteExerciseId))
        .slice(0, 40)
        .map((exercise) => el('button.swaplist__option', {
          type: 'button', dataset: { swapto: exercise.id },
          onclick: async () => {
            const substitutedFor = entry.substitutedFor ?? entry.exercise.id
            const prepared = await workout.prepareExercise(exercise.id, {
              sets: entry.sets.length,
              reps: entry.sets[0]?.reps ?? null,
              weight: null,
            })
            entry.exercise = prepared.exercise
            entry.method = prepared.method
            entry.last = prepared.last
            entry.record = prepared.record
            entry.history = null
            entry.substitutedFor = substitutedFor
            // Structure preserved: same number of sets, same rep target.
            entry.sets = entry.sets.map((set) => ({
              ...set,
              weight: prepared.last?.sets?.[0]?.weight ?? null,
              logged: false, logId: null,
            }))
            openPanel = null
            persistDraft()
            render()
          },
        }, [exercise.name])),
      ),
    ])
  }

  // --- exercise menu -------------------------------------------------------

  function notesPanel(entry) {
    return el('div.panel', {}, [
      el('label.panel__note', { text: 'Notes for this workout' }),
      el('textarea.exercise-notes', {
        rows: 3,
        placeholder: 'Setup, cue, or anything worth remembering',
        value: entry.notes ?? '',
        oninput: (event) => {
          entry.notes = event.target.value
          hasUnloggedEdits = true
          persistDraft()
        },
      }),
    ])
  }

  function removeExercise(entry) {
    const index = plan.indexOf(entry)
    if (index < 0) return
    const logged = entry.sets.filter((set) => set.logged)
    if (logged.length > 0) return
    plan.splice(index, 1)
    openPanel = null
    hasUnloggedEdits = true
    persistDraft()
    render()
  }

  function exerciseMenu(entry, position) {
    const menuOpen = isOpen(entry, 'menu')
    const item = (label, action, options = {}) => el('button.exercise-menu__item', {
      type: 'button',
      disabled: options.disabled === true,
      onclick: action,
    }, [label])
    return el('div.exercise-menu-wrap', {}, [
      el('button.exercise-menu__trigger', {
        type: 'button',
        'aria-label': `More actions for ${displayName(entry.exercise, entry.slot)}`,
        'aria-expanded': String(menuOpen),
        onclick: () => togglePanel(entry, 'menu'),
      }, ['⋯']),
      menuOpen && el('div.exercise-menu', {}, [
        item('History', async () => {
          if (!entry.history) entry.history = await workout.exerciseHistory(entry.exercise.id, 6, activeMethod(entry))
          openPanel = panelKey(entry, 'history'); persistDraft(); render()
        }),
        item('Swap', () => { openPanel = panelKey(entry, 'swap'); render() }),
        item('Notes', () => { openPanel = panelKey(entry, 'notes'); render() }),
        item(`Rest timer · ${clock(entry.restSec)}`, () => { openPanel = panelKey(entry, 'rest'); render() }),
        methodsForExercise(entry.exercise).length > 1
          && item(`Method · ${activeMethod(entry)}`, () => { openPanel = panelKey(entry, 'method'); render() }),
        isBarbell(entry) && item('Plate settings', () => { openPanel = panelKey(entry, 'equipment'); render() }),
        el('button.exercise-menu__item', {
          type: 'button',
          dataset: { action: 'minimize-workout' },
          onclick: minimizeWorkout,
        }, ['Minimize workout']),
        item('Move up', () => move(position, -1), { disabled: position === 0 }),
        item('Move down', () => move(position, 1), { disabled: position === plan.length - 1 }),
        item('Remove exercise', () => removeExercise(entry), { disabled: entry.sets.some((set) => set.logged) }),
      ].filter(Boolean)),
    ])
  }

  // --- exercise card -------------------------------------------------------

  function pauseStretchHold() {
    if (hold?.endsAt == null) return
    hold.remaining = Math.max(0, hold.endsAt - timeSource.now())
    hold.endsAt = null
    render()
  }

  function stretchCard(entry) {
    const next = entry.sets.findIndex((set) => !set.logged)
    return el('section.card.exercise.exercise--r3', { dataset: { exercise: entry.exercise.id, focused: 'true' } }, [
      el('header.exercise__head', {}, [
        el('div.exercise__title', {}, [
          el('h2.exercise__name', { text: entry.exercise.name }),
          el('p.exercise__range', { text: '25 s per hold · 15 s between holds' }),
        ]),
      ]),
      ...entry.sets.map((set, index) => {
        const current = hold?.entry === entry && hold.index === index
        const running = current && hold.endsAt !== null
        return el('div.stretch-hold', { dataset: { done: String(set.logged) } }, [
          el('strong', { text: `${set.side} leg back · Rep ${set.rep}` }),
          el('span', {
            dataset: current ? { stretchCountdown: 'true' } : {},
            text: current ? clock(Math.ceil((running ? Math.max(0, hold.endsAt - timeSource.now()) : hold.remaining) / 1000)) : '0:25',
          }),
          set.logged ? el('span', { 'aria-label': 'Complete' }, [icon('check')])
            : el('button.session-r5__add-movement', {
              type: 'button', disabled: Boolean(rest) || index !== next || Boolean(hold && !current),
              onclick: () => {
                if (running) { pauseStretchHold(); return }
                if (timerPaused) { timerPaused = false; activateWorkoutScreen() }
                const remaining = current ? hold.remaining : 25000
                hold = { entry, index, remaining, endsAt: timeSource.now() + remaining }
                render()
              },
            }, [running ? 'Pause' : current ? 'Resume' : 'Start']),
        ])
      }),
      stretchError && el('p', { role: 'alert', text: stretchError }),
    ])
  }

  function exerciseCard(entry, position) {
    if (stretch) return stretchCard(entry)
    const slot = entry.slot
    const range = slot
      ? `${slot.sets} × ${slot.repMin}–${slot.repMax}`
      : `${entry.sets.length} sets`
    const coaching = entry.proposal?.reason || slot?.cue || slot?.setup || ''
    const best = entry.record?.bestWeight
    const fields = fieldsFor(entry.exercise)

    return el('section.card.exercise.exercise--r3', {
      dataset: { exercise: entry.exercise.id, method: activeMethod(entry) ?? '', focused: String(position === focusStageIndex) },
    }, [
      el('header.exercise__head', { dataset: { hasArt: String(Boolean(entry.exercise.art)) } }, [
        entry.exercise.art && el('button.exercise__art', {
          type: 'button',
          'aria-label': `Show ${entry.exercise.name} reference`,
          dataset: { art: entry.exercise.id },
          onclick: () => openExerciseArt(entry),
        }, [el('img.exercise__thumb', {
          src: artUrl(entry.exercise.art), alt: '', loading: 'lazy',
        })]),
        el('div.exercise__title', {}, [
          el('h2.exercise__name', { text: displayName(entry.exercise, entry.substitutedFor ? null : entry.slot) }),
          el('button.exercise__range', {
            type: 'button',
            onclick: () => { openPanel = panelKey(entry, 'rest'); render() },
            text: `${range} · Rest ${clock(entry.restSec)}${slot?.optional ? ' · If available' : ''}`,
          }),
        ]),
        exerciseMenu(entry, position),
      ]),

      best && el('p.exercise__best', {
        text: `Best ${lbs(best.weight)} lb × ${best.reps}${best.date ? ` · ${shortDate(best.date).replace(/ \d{4}$/, '')}` : ''}`,
      }),
      coaching && el('p.exercise__proposal', { text: coaching }),

      isOpen(entry, 'rest') && el('div.panel', {}, [
        el('p.panel__note', { text: 'Rest between sets. The timer never blocks the next set.' }),
        el('div.restedit', {}, [30, 60, 90, 120, 150, 180, 240].map((seconds) => el('button.restedit__option', {
          type: 'button', dataset: { restset: String(seconds), active: String(entry.restSec === seconds) },
          onclick: () => {
            entry.restSec = seconds
            openPanel = null
            hasUnloggedEdits = true
            persistDraft()
            render()
          },
        }, [clock(seconds)]))),
      ]),
      isOpen(entry, 'history') && historyPanel(entry),
      isOpen(entry, 'method') && methodPanel(entry),
      isOpen(entry, 'swap') && swapPanel(entry),
      isOpen(entry, 'equipment') && equipmentPanel(entry),
      isOpen(entry, 'notes') && notesPanel(entry),
      isOpen(entry, 'art') && el('div.panel.panel--art', {}, [
        el('img.exercise__full', { src: artUrl(entry.exercise.art), alt: entry.exercise.name }),
      ]),

      el('div.setrow.setrow--head', {}, [
        el('span.setrow__index', { text: 'Set' }),
        el('span.setrow__record', { text: 'Previous' }),
        ...fields.map((field) => el('span.setrow__col', {
          dataset: field ? { col: field.key } : {},
          text: field?.key === 'weight' ? 'lbs' : (field?.label === 'REPS' ? 'Reps' : field?.label ?? ''),
        })),
        el('span.setrow__head-check', {}, [icon('check')]),
      ]),

      ...entry.sets.map((set, index) => setRow(entry, set, index)),

      el('button.addset', {
        type: 'button', dataset: { addset: entry.exercise.id },
        onclick: () => {
          const previous = entry.sets.at(-1)
          entry.sets.push({
            weight: previous?.weight ?? null,
            reps: previous?.reps ?? null,
            logged: false,
            setType: 'working',
            logId: null,
          })
          hasUnloggedEdits = true
          persistDraft()
          render()
        },
      }, ['+ Add set']),
    ])
  }

  function move(position, direction) {
    const target = position + direction
    if (target < 0 || target >= plan.length) return
    const [moved] = plan.splice(position, 1)
    plan.splice(target, 0, moved)
    persistDraft()
    render()
  }

  // --- screen --------------------------------------------------------------

  function loggedCount() {
    return plan.reduce((total, entry) => total + entry.sets.filter((s) => s.logged).length, 0)
  }

  /** Replaces the thin line with set-aware movement navigation. */
  function progressRail() {
    const all = plan.reduce((n, item) => n + item.sets.length, 0)
    const completed = plan.filter((item) => item.sets.length > 0
      && item.sets.every((set) => set.logged)).length
    const views = { focus: 'Focus Stack', cards: 'Chapter Cards', matrix: 'Set Matrix' }
    return el('section.session-progress', { dataset: { progressView }, 'aria-label': stretch ? 'Stretch progress' : 'Workout movement progress' }, [
      el('div.session-progress__meta', {}, [
        el('div.session-progress__counts', {}, [
          el('strong', { text: 'Movement ' + (focusStageIndex + 1) + ' of ' + plan.length }),
          el('span', { text: loggedCount() + ' / ' + all + (stretch ? ' holds · ' : ' sets · ') + completed + ' complete' }),
        ]),
        el('button.session-progress__switch', {
          type: 'button', dataset: { action: 'progress-view' },
          title: 'Change progress view',
          'aria-label': 'Progress view ' + views[progressView] + '. Switch to next view.',
          onclick: () => {
            const options = ['focus','cards','matrix']
            progressView = options[(options.indexOf(progressView) + 1) % options.length]
            try { globalThis.localStorage?.setItem(PROGRESS_VIEW_KEY, progressView) } catch {}
            render()
          },
        }, [icon('swap'), el('span', { text: views[progressView] })]),
      ]),
      el('div.session-progress__nodes', { role: 'group', 'aria-label': stretch ? 'Stretches' : 'Workout movements' },
        plan.map((item, index) => {
          const done = item.sets.filter((set) => set.logged).length
          const finished = item.sets.length > 0 && done === item.sets.length
          const name = displayName(item.exercise, item.slot)
          return el('button.session-progress__node', {
            type: 'button', title: name,
            dataset: { movement: String(index + 1),
              focused: String(index === focusStageIndex), complete: String(finished) },
            'aria-current': index === focusStageIndex ? 'step' : null,
            'aria-label': name + ', ' + done + ' of ' + item.sets.length + (stretch ? ' holds complete' : ' sets logged'),
            onclick: () => focusExercise(index),
          }, [
            el('span.session-progress__number', { text: finished ? '✓' : String(index + 1) }),
            el('strong.session-progress__name', { text: name }),
            el('span.session-progress__count', { text: done + '/' + item.sets.length }),
            el('span.session-progress__ticks', { 'aria-hidden': 'true' },
              item.sets.map((set) => el('i', { dataset: { logged: String(Boolean(set.logged)) } }))),
          ])
        })),
    ])
  }

  /** A hold previews the controls. Only a tap or keyboard activation runs an action. */
  function glassAction({ className, symbol, label, data, ariaLabel, activate }) {
    let press = null
    let holdTimer
    let suppressClick = false
    const button = el('button.session-glass', {
      class: className, type: 'button',
      dataset: { ...(data ?? {}) },
      'aria-label': ariaLabel || label,
    }, [
      el('span.session-glass__glyph', { 'aria-hidden': 'true' }, [icon(symbol)]),
      el('span.session-glass__label', { text: label, 'aria-hidden': 'true' }),
    ])
    const endPress = (event) => {
      if (event.pointerId !== press?.id) return
      clearTimeout(holdTimer)
      if (button.dataset.expanded === 'true') {
        button.removeAttribute('data-expanded')
        button.parentElement?.removeAttribute('data-holding')
      }
      press = null
    }
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || press || button.disabled) return
      suppressClick = false
      press = { id: event.pointerId, x: event.clientX, y: event.clientY }
      if (event.isTrusted) button.setPointerCapture?.(event.pointerId)
      holdTimer = setTimeout(() => {
        suppressClick = true
        button.dataset.expanded = 'true'
        button.parentElement?.setAttribute('data-holding', 'true')
      }, 270)
    })
    button.addEventListener('pointermove', (event) => {
      if (event.pointerId !== press?.id) return
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 10) return
      suppressClick = true
      endPress(event)
    })
    button.addEventListener('pointerup', endPress)
    button.addEventListener('pointercancel', endPress)
    button.addEventListener('lostpointercapture', endPress)
    for (const eventName of ['selectstart', 'contextmenu']) {
      button.addEventListener(eventName, (event) => event.preventDefault())
    }
    button.addEventListener('click', (event) => {
      if (suppressClick && event.detail > 0) {
        event.preventDefault()
        return
      }
      activate(event)
    })
    return button
  }

  function focusExercise(index) {
    focusStageIndex=Math.max(0,Math.min(plan.length-1,index))
    persistDraft()
    render()
    root.querySelector(`.session-r5__log [data-exercise="${plan[focusStageIndex]?.exercise.id}"]`)?.scrollIntoView?.({ block:'nearest', behavior:'smooth' })
  }

  function visualStage() {
    const entry=plan[focusStageIndex] ?? plan[0]
    if(!entry)return null
    const done=entry.sets.filter(set=>set.logged).length
    const movementName=displayName(entry.exercise,entry.slot)
    return el('aside.session-r5__stage', { dataset:{stageExercise:entry.exercise.id} }, [
      el('div.session-r5__visual', {}, [
        entry.exercise.art
          ? el('button.session-r5__visual-open',{
              type:'button',
              'aria-label':`Enlarge photos for ${movementName}`,
              dataset:{action:'enlarge-exercise-art'},
              onclick:()=>openExerciseArt(entry),
            },[
              el('img',{src:stretch ? entry.exercise.art : artUrl(entry.exercise.art),alt:`${movementName} exercise reference`,loading:'lazy'}),
              el('span.session-r5__zoom-hint',{},[icon('expand'),' Enlarge']),
            ])
          : el('div.session-r5__visual-fallback', {}, [icon('train')]),
        el('div.session-r5__visual-shade'),
        el('span.session-r5__image-tag', {text:`MOVEMENT ${focusStageIndex+1} / ${plan.length}`}),
      ]),
      el('div.session-r5__stage-copy', {}, [
        el('p.session-r5__eyebrow', { text:'CURRENT MOVEMENT' }),
        el('h2', { text:movementName }),
        el('p.session-r5__stage-target', { text:stretch ? '4 holds · 25 s each' : entry.slot
          ? `${entry.slot.repMin}–${entry.slot.repMax} reps · ${clock(entry.restSec)} rest`
          : `${entry.sets.length} sets · ${clock(entry.restSec)} rest` }),
        el('div.session-r5__stage-cue', {}, [
          el('strong', {text:'FORM FOCUS'}),
          el('p', {text:entry.slot?.cue || entry.slot?.setup || entry.proposal?.reason || 'Work through the full range of motion. Control every rep.' }),
        ]),
        el('div.session-r5__stage-totals', {}, [
          el('div', {}, [el('strong',{text:`${done} / ${entry.sets.length}`}),el('small',{text:stretch ? 'Stretch holds' : 'Movement sets'})]),
          el('div', {}, [el('strong',{text:`${loggedCount()} / ${plan.reduce((n,e)=>n+e.sets.length,0)}`}),el('small',{text:stretch ? 'Total holds' : 'Total sets'})]),
          el('div', {}, [
            entry.record?.bestWeight
              ? el('strong',{text:`${lbs(entry.record.bestWeight.weight)} × ${entry.record.bestWeight.reps}`})
              : el('strong',{text:clock(elapsedSeconds()),dataset:{stageClock:'true'}}),
            el('small',{text:entry.record?.bestWeight?'Best set':'Elapsed time'}),
          ]),
        ]),
        stretch && el('p.stretch-photo-credit', {}, [
          'Photo: ', el('a', { href: 'https://doi.org/10.3390/biomedicines12081729', target: '_blank', rel: 'noopener', text: 'Covelli et al. (2024), Fig. 1' }),
          ' · Cropped · ', el('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener', text: 'CC BY 4.0' }),
        ]),
        el('div.session-r5__stage-nav', {}, [
          el('button',{type:'button',disabled:focusStageIndex===0,onclick:()=>focusExercise(focusStageIndex-1)},['← Previous']),
          el('button',{type:'button',disabled:focusStageIndex===plan.length-1,onclick:()=>focusExercise(focusStageIndex+1)},[stretch ? 'Next stretch →' : 'Next exercise →']),
        ]),
      ]),
    ])
  }

  function setHalfFold(enabled) {
    halfFold = enabled && plan.length > 0
    openPanel = null
    persistDraft()
    render()
  }

  function halfFoldToggle() {
    return el('button.session-layout-toggle', {
      type: 'button',
      dataset: { halfFoldToggle: 'true' },
      'aria-pressed': String(halfFold),
      onclick: () => setHalfFold(!halfFold),
    }, [halfFold ? 'Full screen' : 'Half-fold'])
  }

  function selectHalfFoldExercise(index) {
    halfFoldIndex = Math.max(0, Math.min(plan.length - 1, Number(index) || 0))
    openPanel = null
    addingMovement = false
    persistDraft()
    render()
  }

  function halfFoldStage(entry) {
    const completed = entry.sets.filter(set => set.logged).length
    const next = entry.sets.findIndex(set => !set.logged)
    const target = entry.slot
      ? `${entry.slot.repMin}–${entry.slot.repMax} reps · ${clock(entry.restSec)} rest`
      : `${entry.sets.length} sets · ${clock(entry.restSec)} rest`
    return el('section.half-fold__stage', { 'aria-label': 'Exercise display' }, [
      el('div.half-fold__visual', {}, [
        entry.exercise.art
          ? el('img.half-fold__art', { src: artUrl(entry.exercise.art), alt: `${entry.exercise.name} exercise reference` })
          : el('div.half-fold__art-fallback', {}, [icon('train')]),
        el('div.half-fold__guidance', {}, [
          el('p.half-fold__eyebrow', { text: `Exercise ${halfFoldIndex + 1} of ${plan.length}` }),
          el('h2.half-fold__title', { text: displayName(entry.exercise, entry.slot) }),
          el('p.half-fold__target', { text: target }),
          session?.deload && el('p.half-fold__deload', { text: 'Deload week. Hold the weight; recovery is half the work.' }),
          el('p.half-fold__cue', { text: entry.slot?.cue || entry.slot?.setup || entry.proposal?.reason || 'Record the work you actually do.' }),
          el('div.half-fold__progress-copy', {}, [
            el('strong', { text: next < 0 ? 'Movement complete' : `Next: set ${next + 1}` }),
            el('span', { text: `${completed} / ${entry.sets.length} logged` }),
          ]),
          el('progress.half-fold__progress', { max: Math.max(1, entry.sets.length), value: completed, 'aria-label': 'Current movement sets logged' }),
          el('p.half-fold__total', { text: `${loggedCount()} / ${plan.reduce((sum, item) => sum + item.sets.length, 0)} sets this workout` }),
        ]),
      ]),
    ])
  }

  function halfFoldControls(entry) {
    return el('section.half-fold__controls', { 'aria-label': 'Workout controls' }, [
      el('div.half-fold__toolbar', {}, [
        el('button.half-fold__step', { type: 'button', 'aria-label': 'Previous movement', disabled: halfFoldIndex === 0, onclick: () => selectHalfFoldExercise(halfFoldIndex - 1) }, ['‹']),
        el('select.half-fold__select', {
          'aria-label': 'Workout movement',
          onchange: event => selectHalfFoldExercise(event.target.value),
        }, plan.map((item, index) => el('option', { value: String(index), selected: index === halfFoldIndex }, [`${index + 1}. ${displayName(item.exercise, item.slot)}`]))),
        el('button.half-fold__step', { type: 'button', 'aria-label': 'Next movement', disabled: halfFoldIndex === plan.length - 1, onclick: () => selectHalfFoldExercise(halfFoldIndex + 1) }, ['›']),
        halfFoldToggle(),
      ]),
      el('div.half-fold__logging', {}, [
        exerciseCard(entry, halfFoldIndex),
        movementPicker(),
      ]),
    ])
  }

  function movementPicker() {
    return addingMovement
      ? addMovementPanel()
      : el('button.button.button--wide.session-add__open', {
          type: 'button', dataset: { action: 'add-movement' },
          onclick: () => {
            addingMovement = true
            render()
            requestAnimationFrame(() => root.querySelector('.session-add__search')?.focus())
          },
        }, [icon('plus'), 'Add movement'])
  }

  async function addMovement(exercise) {
    const prepared = await workout.prepareExercise(exercise.id, {
      sets: 3, reps: null, weight: null,
    })
    if (!prepared.exercise) return
    plan.push({
      ...prepared,
      ...entryDefaults(),
      restSec: 150,
      sets: prepared.proposal.sets.map((set) => ({ ...set, logged: false, logId: null })),
    })
    if (halfFold) halfFoldIndex = plan.length - 1
    addingMovement = false
    addQuery = ''
    hasUnloggedEdits = true
    persistDraft()
    render()
    requestAnimationFrame(() => root.querySelector(`[data-exercise="${exercise.id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
  }

  function addMovementPanel() {
    const used = new Set(plan.map((entry) => entry.exercise.id))
    const query = addQuery.trim().toLowerCase()
    const choices = library
      .filter((exercise) => !used.has(exercise.id))
      .filter((exercise) => !query || exercise.name.toLowerCase().includes(query))
      .slice(0, 60)
    return el('section.session-add', { dataset: { addMovementPanel: 'true' } }, [
      el('div.session-add__head', {}, [
        el('div', {}, [
          el('h2.session-add__title', { text: 'Add movement' }),
          el('p.session-add__note', { text: 'Add it to this workout without changing your saved program.' }),
        ]),
        el('button.iconbutton', {
          type: 'button', 'aria-label': 'Close movement library',
          onclick: () => { addingMovement = false; addQuery = ''; render() },
        }, ['×']),
      ]),
      el('input.session-add__search', {
        type: 'search', placeholder: 'Search exercises', value: addQuery,
        'aria-label': 'Search exercises to add',
        oninput: (event) => { addQuery = event.target.value; render(); root.querySelector('.session-add__search')?.focus() },
      }),
      el('details', {}, [el('summary.button', { text: 'Create custom exercise' }), customExerciseForm({ workout, name: addQuery, onCancel: () => render(), onSave: async (exercise) => { library.push(exercise); await addMovement(exercise) } })]),
      el('div.swaplist', {}, choices.length
        ? choices.map((exercise) => el('button.swaplist__option', {
            type: 'button', dataset: { addExercise: exercise.id },
            onclick: () => addMovement(exercise),
          }, [exercise.name]))
        : [el('p.panel__note', { text: query ? 'No matching unused movements.' : 'Every movement is already in this workout.' })]),
    ])
  }

  function restBar({inline=false}={}) {
    if (!rest) return null
    const remaining = Math.max(0, (Number(rest.endsAt) - timeSource.now()) / 1000)
    return el('div.session-restbar', { dataset: { restBar: 'true', sessionRestOverlay: 'true', ...(inline?{inlineRest:'true'}:{sessionOverlay:'true'}) } }, [
      el('div.session-restbar__progress', {}, [
        el('i', {
          dataset: { restProgress: 'true' },
          style: `width:${Math.max(0, Math.min(100, (remaining / Math.max(1, rest.durationSec ?? remaining ?? 1)) * 100))}%`,
        }),
      ]),
      el('strong.session-restbar__time', { dataset: { restRemaining: 'true' }, text: `Rest ${clock(remaining)}` }),
      el('div.session-restbar__actions', {}, [
        el('button', { type: 'button', onclick: () => adjustRest(-15) }, ['-15']),
        el('button', { type: 'button', onclick: () => adjustRest(15) }, ['+15']),
        el('button', { type: 'button', onclick: skipRest }, ['Skip']),
      ]),
    ])
  }

  function openExerciseArt(entry) {
    if(!entry?.exercise?.art)return
    artViewer={art:entry.exercise.art,name:displayName(entry.exercise,entry.slot)}
    document.querySelector('[data-session-art-overlay]')?.remove()
    document.body.append(exerciseArtViewer())
    document.querySelector('[data-session-art-close]')?.focus()
  }
  function closeExerciseArt() {
    artViewer=null
    document.querySelector('[data-session-art-overlay]')?.remove()
    root.querySelector('[data-action="enlarge-exercise-art"]')?.focus({preventScroll:true})
  }
  function exerciseArtViewer() {
    if(!artViewer)return null
    const frame=el('div.session-art-viewer__frame',{},[
      el('div.session-art-viewer__bar',{},[
        el('strong',{text:artViewer.name}),
        el('button.session-art-viewer__close',{
          type:'button',dataset:{sessionArtClose:'true'},'aria-label':'Close exercise photos',
          onclick:closeExerciseArt,
        },[icon('close')]),
      ]),
      el('img.session-art-viewer__image',{
        src:stretch ? artViewer.art : artUrl(artViewer.art),alt:`${artViewer.name} exercise demonstration`,
      }),
      el('p.session-art-viewer__hint',{text:'Pinch to zoom · Tap outside or × to close'}),
    ])
    return el('div.session-art-viewer',{
      role:'dialog','aria-modal':'true','aria-label':`Photos for ${artViewer.name}`,
      dataset:{sessionOverlay:'true',sessionArtOverlay:'true'},
      onclick:event=>{if(event.target===event.currentTarget)closeExerciseArt()},
    },[frame])
  }

  /** The rest bar and confirmation sheets live on <body>, outside the screen:
   *  iOS makes the scrolling app body its own stacking context, so a sheet left
   *  inside it can never rise above the body-level rest bar. */
  function clearBodyOverlays() {
    document.querySelectorAll('[data-session-overlay]').forEach((node) => node.remove())
  }

  function minimizeWorkout() {
    artViewer=null
    // The checkpoint is saved before removing this screen so checked sets,
    // edited fields and remaining exercise slots survive the detour to Today.
    pauseElapsedTimer()
    persistDraft()
    const checkpoint = loadActiveSessionDraft()
    if (checkpoint) saveActiveSessionDraft({ ...checkpoint, minimized: true })
    clearBodyOverlays()
    onMinimize?.()
  }

  function cancelWorkout() {
    if (stretch && savingStretch) return
    if (stretch && loggedCount() === 0 && !hold) { onFinish(null); return }
    if (stretch) pauseStretchHold()
    // Cancel and Finish must never converge: cancelling only offers discard.
    confirmingFinish = false
    confirmingDiscard = true
    discardFailure = ''
    render()
  }

  async function discardWorkout() {
    if (discardingWorkout || !session) return
    if (stretch) { if (!savingStretch) onFinish(null); return }
    discardingWorkout = true
    discardFailure = ''
    try {
      await workout.abortSession(session, loggedHere)
      clearBodyOverlays()
      clearActiveSessionDraft()
      releaseWorkoutWakeLock()
      onFinish(null)
    } catch (error) {
      console.error('[tempered] workout discard failed', error)
      discardFailure = 'Could not discard this session; try again.'
      discardingWorkout = false
      render()
    }
  }

  function cardioFinisherCard() {
    if (!session?.finisher) return null
    const target = session.cardioTarget
    return el('section.card.cardio-finisher', { dataset: { cardioFinisher: 'true' } }, [
      el('h2', { text: 'Optional cardio finisher' }),
      target && el('div.cardio-finisher__zone', { dataset: { zone2Target: 'true' } }, [
        el('span.cardio-finisher__caption', { text: 'YOUR ESTIMATED ZONE 2 TARGET' }),
        el('strong.cardio-finisher__bpm', {
          text: `${target.lowBpm}–${target.highBpm} bpm`,
        }),
        el('small', { text: `Estimated upper guide: ~${target.estimatedUpperBpm} bpm · talk test first` }),
      ]),
      el('p', { text: session.finisher }),
      target?.guidance && el('p.cardio-finisher__guidance', { text: target.guidance }),
      onStartCardio && el('button.cardio-finisher__launch', {
        type: 'button', dataset: { action: 'quick-cardio' },
        onclick: onStartCardio,
      }, ['Start 10-min cardio']),
    ])
  }

  function render() {
    const duoLayout = document.documentElement.dataset.layout === 'duo'
    if (plan.length === 0 || !duoLayout) halfFold = false
    halfFoldIndex = Math.max(0, Math.min(plan.length - 1, halfFoldIndex))
    root.dataset.halfFold = String(halfFold)
    root.dataset.timerPaused = String(timerPaused)
    root.dataset.restActive = String(Boolean(rest))
    const inlineRestDock=isInlineRestDock()
    const selectedEntry = plan[halfFoldIndex]
    replace(root, [
      el('header.sessionbar.sessionbar--r3.sessionbar--glass', {}, [
        el('div.sessionbar__center', {}, [
          el('img.sessionbar__lfms-mark', {
            src: new URL('../../../branding/lfms/logo-mark.svg', import.meta.url).href,
            alt: 'Less Fat More Strong',
          }),
          el('h1.sessionbar__title', { text: session?.title ?? 'Workout' }),
          el('span.sessionbar__elapsed-value', {
            dataset: { sessionElapsed: 'true' }, text: clock(elapsedSeconds()),
          }),
        ]),
        el('div.sessionbar__actions', { role: 'group', 'aria-label': stretch ? 'Stretch controls' : 'Workout controls' }, [
          glassAction({ className: 'sessionbar__cancel', symbol: 'close', label: 'Exit',
            data: { action: 'cancel-session' }, activate: cancelWorkout }),
          glassAction({ className: 'sessionbar__timer-toggle',
            symbol: timerPaused ? 'play' : 'pause', label: timerPaused ? 'Resume' : 'Pause',
            data: { action: 'toggle-session-timer', paused: String(timerPaused) },
            ariaLabel: timerPaused ? stretch ? 'Resume stretch timer' : 'Resume workout timer' : stretch ? 'Pause stretch timer' : 'Pause workout timer',
            activate: toggleWorkoutTimer }),
          !stretch && glassAction({ className: 'sessionbar__minimize', symbol: 'minus', label: 'Minimize',
            data: { action: 'minimize-workout' },
            ariaLabel: 'Minimize workout and log water or food', activate: minimizeWorkout }),
          !stretch && glassAction({ className: 'plate-calculator-link', symbol: 'calculator', label: 'Calculator',
            data: { openPlateCalculator: 'true' }, ariaLabel: 'Plate calculator',
            activate: (event) => openPlateCalculator(event.currentTarget) }),
          stretch && loggedCount() === 8 && glassAction({ className: 'sessionbar__finish',
            symbol: 'check', label: 'Save stretches', data: { action: 'save-stretches' },
            activate: finish }),
          !stretch && glassAction({ className: 'sessionbar__finish', symbol: 'check', label: 'Finish',
            data: { action: 'finish' },
            activate: () => { confirmingFinish = true; render() } }),
        ]),
      ]),

      ...(halfFold ? [halfFoldStage(selectedEntry), halfFoldControls(selectedEntry)] : [
        plan.length > 0 && el('div.session-r5__progress-wrap', {}, [progressRail()]),
        el('div.session-r5__workspace', {}, [
          visualStage(),
          el('div.session-r5__log', {}, [
            !stretch && duoLayout && plan.length > 0 && el('div.session-display-tools', {}, [
              el('button.session-r5__add-movement', {type:'button',
                 dataset:{action:'add-movement'},onclick:()=>{
                   addingMovement=true
                   render()
                   requestAnimationFrame(()=>root.querySelector('.session-add__search')?.focus())
                 },
               }, ['+ Movement']),
               halfFoldToggle(),
            ]),
            session?.deload && el('p.deload', { text: 'Deload week. Hold the weight — recovery is half the work.' }),
            ...(stretch ? [exerciseCard(plan[focusStageIndex], focusStageIndex)] : plan.map(exerciseCard)),
            stretch && loggedCount() === 8 && el('button.session-r5__add-movement', {
              type: 'button', disabled: loggedCount() !== 8 || savingStretch, onclick: finish,
            }, ['Save to Daily Log']),
            // Cardio has its own screen; the live lifting view stays focused on sets.
            !stretch && (!duoLayout || plan.length===0 || addingMovement) && movementPicker(),
            inlineRestDock && rest && restBar({inline:true}),
          ]),
        ]),
      ]),

    ])
    clearBodyOverlays()
    if (rest && !inlineRestDock) document.body.append(restBar())
    if (artViewer) document.body.append(exerciseArtViewer())
    const sheet = confirmingFinish ? finishSheet() : confirmingDiscard ? discardSheet() : null
    if (sheet) document.body.append(sheet)
    syncHalfFoldViewport()
    if (halfFold && !openPanel && !addingMovement) requestAnimationFrame(() => {
      root.querySelector('.half-fold__logging .setrow[data-done="false"]')?.scrollIntoView({ block: 'nearest' })
    })
    tick()
  }

  function finishSheet() {
    return el('div.session-sheet', { dataset: { sessionOverlay: 'true' } }, [
      el('div.session-sheet__card', {}, [
        el('p.session-sheet__title', { text: `Finish with ${loggedCount()} ${loggedCount() === 1 ? 'set' : 'sets'} logged?` }),
        el('p.session-sheet__copy', { text: 'Logged sets are kept and count toward your history when you finish.' }),
        el('div.session-sheet__actions', {}, [
          el('button', {
            type: 'button', dataset: { action: 'cancel-finish' },
            onclick: () => { confirmingFinish = false; render() },
          }, ['Keep going']),
          el('button', {
            type: 'button', dataset: { action: 'confirm-finish' },
            onclick: finish,
          }, ['Finish']),
        ]),
      ]),
      ])
  }

  function discardSheet() {
    return el('div.session-sheet', { dataset: { sessionOverlay: 'true' } }, [
      el('div.session-sheet__card', {}, [
        el('p.session-sheet__title', { text: stretch ? 'Exit this stretch session?' : 'Exit without saving this workout?' }),
        el('p.session-sheet__copy', { text: stretch ? 'Your completed holds from this session will be discarded.' : `Remove ${loggedCount()} logged ${loggedCount() === 1 ? 'set' : 'sets'} from this workout? This cannot be undone. Earlier workouts are unaffected.` }),
        discardFailure && el('p.session-sheet__error', { role:'alert', text:discardFailure }),
        el('div.session-sheet__actions', {}, [
          el('button', {
            type: 'button',
            onclick: () => { confirmingDiscard = false; render() },
          }, [stretch ? 'Keep stretching' : 'Keep workout']),
          el('button', {
            type: 'button',
            dataset: { confirmAction: 'discard' },
            disabled: discardingWorkout,
            onclick: discardWorkout,
          }, [discardingWorkout ? 'Discarding…' : 'Exit without saving']),
        ]),
      ]),
      ])
  }

  async function finish() {
    if (stretch) {
      if (savingStretch || loggedCount() !== 8) return
      savingStretch = true
      render()
      try {
        await stretch.save(loggedCount())
        onFinish(null)
      } catch {
        savingStretch = false
        stretchError = 'Could not save. Try again.'
        render()
      }
      return
    }
    clearBodyOverlays()
    const summary = await workout.finishSession(session, {
      isFirstOfDay,
      // When Pause was used, report the intentionally measured active clock
      // rather than inferring a continuous sitting across the interruption.
      ...(timerPauseUsed ? { durationMinutes: Math.max(1, Math.round(elapsedSeconds() / 60)) } : {}),
      // A block settles everything it logged; a single slot settles only itself,
      // because the day's session may already carry earlier slots.
      ...(session.slotMode ? { onlySets: loggedHere } : {}),
    })
    // Clear only after settlement succeeds. If finishing throws, the checkpoint
    // remains so an iOS process eviction cannot turn a recoverable workout into
    // lost UI state.
    clearActiveSessionDraft()
    // `null` means nothing was logged. There is nothing to summarise, so the
    // screen closes without one rather than reporting an empty session back.
    onFinish(summary)
  }

  /** Everything a plan entry carries beyond what the workout service prepared. */
  const entryDefaults = () => ({
    barWeight: 45,
    plates: [...DEFAULT_PLATES],
    substitutedFor: null,
    history: null,
    editing: false,
  })

  return {
    root,

    startStretch(save) {
      stretch = { save }
      root.dataset.stretchSession = 'true'
      session = { title: 'Foot Mobility' }
      plan = ['Straight', 'Bent'].map((knee) => ({
        exercise: {
          id: knee.toLowerCase() + '-knee',
          name: knee + '-knee calf stretch',
          unit: 'time',
          art: stretchPhotos[knee],
        },
        slot: {
          cue: `Hands on the wall, back heel and toes flat. ${knee === 'Bent' ? 'Soften the back knee.' : 'Keep the back knee straight.'} Lean gently. Stop if heel, arch, or big-toe pain starts.`,
        },
        restSec: 15,
        sets: [1, 2].flatMap((rep) => ['Left', 'Right'].map((side) => ({ side, rep, logged: false }))),
      }))
      activateWorkoutScreen()
      render()
    },

    /**
     * @param {object} options
     * @param {object|null} [options.routine]
     * @param {object|null} [options.programDay]  A day from the active program.
     * @param {string|null} [options.exerciseId]  For an ad-hoc single exercise.
     */
    async start({ routine = null, programDay = null, exerciseId = null, slotTask = null, returnTab = 'today' }) {
      artViewer=null
      halfFold = false
      halfFoldIndex = 0
      focusStageIndex = 0
      elapsedSec = 0
      activeSince = null
      timerPaused = false
      timerPauseUsed = false
      activateWorkoutScreen()
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      plan = []
      loggedHere = []
      isFirstOfDay = true
      hasUnloggedEdits = false
      confirmingDiscard = false

      // One slot, opened from Today. It joins the day's session rather than
      // starting a ceremony of its own.
      if (slotTask) {
        const opened = await workout.openDaySession()
        session = opened.session
        isFirstOfDay = opened.isFirstOfDay
        session.slotMode = true
        session.title = slotTask.slot?.name ?? 'Exercise'
        const active = await workout.activeProgram()
        session.weekLabel = active ? `Week ${active.week} of ${active.program.weeks}` : null
        session.deload = active?.deload === true

        const prepared = await workout.prepareSlot(
          slotTask.slot, active?.week ?? 1, active?.program ?? { weeks: 1 })
        if (prepared.exercise) {
          const remaining = Math.max(1, (slotTask.slot.sets ?? 3) - (slotTask.alreadyLogged ?? 0))
          plan.push({
            ...prepared,
            ...entryDefaults(),
            restSec: slotTask.slot.restSec?.[0] ?? 120,
            programDayId: slotTask.dayId,
            slotIndex: slotTask.slotIndex,
            sets: prepared.proposal.sets.slice(0, remaining)
              .map((set) => ({ ...set, logged: false, logId: null })),
          })
        }
        session.returnTab = returnTab
        persistDraft()
        render()
        return
      }

      if (programDay) {
        const active = await workout.activeProgram()
        session = await workout.startSession(null)
        session.programId = active?.program.id ?? null
        session.programDayId = programDay.id
        session.title = programDay.name
        session.weekLabel = active ? `Week ${active.week} of ${active.program.weeks}` : null
        session.deload = active?.deload === true
        session.finisher = programDay.finisher ?? null
        session.cardioTarget = active?.program?.cardioTarget ?? null

        for (const [slotIndex, slot] of programDay.exercises.entries()) {
          const prepared = await workout.prepareSlot(slot, active?.week ?? 1, active?.program ?? { weeks: 1 })
          if (!prepared.exercise) continue
          plan.push({
            ...prepared,
            ...entryDefaults(),
            restSec: slot.restSec?.[0] ?? 120,
            programDayId: programDay.id,
            slotIndex,
            sets: prepared.proposal.sets.map((set) => ({ ...set, logged: false, logId: null })),
          })
        }
      } else {
        session = await workout.startSession(routine?.id ?? null)
        session.title = routine?.name ?? 'Single exercise'
        const wanted = routine ? routine.exercises : [{ id: exerciseId, sets: 3, reps: null, weight: null }]
        for (const entry of wanted) {
          const prepared = await workout.prepareExercise(entry.id, {
            sets: entry.sets, reps: entry.reps, weight: entry.weight, distance: entry.distance,
          })
          if (!prepared.exercise) continue
          plan.push({
            ...prepared,
            ...entryDefaults(),
            restSec: entry.rest ?? 150,
            ...(entry.repMax ? { slot: { sets: entry.sets, repMin: entry.repMin, repMax: entry.repMax } } : {}),
            sets: prepared.proposal.sets.map((set) => ({ ...set, logged: false, logId: null })),
          })
        }
      }
      session.returnTab = returnTab
      persistDraft()
      render()
    },

    async resume(draft) {
      artViewer=null
      // Old checkpoints stored an absolute start time, so time spent with the
      // app closed inflated the workout into hundreds of minutes. Missing
      // elapsedSec is intentionally treated as zero rather than repeating it.
      elapsedSec = Number.isFinite(draft.elapsedSec) ? Math.max(0, draft.elapsedSec) : 0
      activeSince = null
      // V1 checkpoints without these fields continue running as before.
      timerPaused = draft.timerPaused === true
      timerPauseUsed = draft.timerPauseUsed === true || timerPaused
      activateWorkoutScreen()
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      session = { ...draft.session }
      plan = Array.isArray(draft.plan) ? draft.plan : []
      halfFold = draft.halfFold === true
      halfFoldIndex = Number.isInteger(draft.halfFoldIndex) ? draft.halfFoldIndex : 0
      focusStageIndex = Number.isInteger(draft.focusStageIndex) ? Math.max(0,Math.min(plan.length-1,draft.focusStageIndex)) : 0
      isFirstOfDay = draft.isFirstOfDay !== false
      openPanel = draft.openPanel ?? null
      confirmingFinish = false
      confirmingDiscard = false
      hasUnloggedEdits = draft.hasUnloggedEdits === true
      addingMovement = false
      addQuery = ''
      rest = draft.rest && Number(draft.rest.endsAt) > timeSource.now()
        ? {
            ...draft.rest,
            durationSec: Number(draft.rest.durationSec)
              || plan.find((entry) => entry.exercise.id === draft.rest.exerciseId)?.restSec
              || Math.max(1, (Number(draft.rest.endsAt) - timeSource.now()) / 1000),
          }
        : null

      const logs = await workout.setsFor(session.id)
      const liveLogIds = new Set(logs.map((log) => log.id))
      const loggedHereIds = new Set(draft.loggedHereIds ?? [])
      loggedHere = logs.filter((log) => loggedHereIds.has(log.id))
      workout.adoptActiveSession?.(session, loggedHere.map((log) => log.id))

      // IndexedDB is canonical for checked sets. Reconcile the checkpoint in
      // case the app was killed after the set write but before its next paint.
      for (const entry of plan) {
        const storedForEntry = logs.find((log) => log.exerciseId === entry.exercise.id
          && (entry.programDayId == null || log.programDayId === entry.programDayId)
          && (entry.slotIndex == null || log.slotIndex === entry.slotIndex))
        entry.method = methodForExercise(entry.exercise, entry.method ?? storedForEntry?.method)
        for (const [index, set] of entry.sets.entries()) {
          const stored = logs.find((log) => log.exerciseId === entry.exercise.id
            && (entry.programDayId == null || log.programDayId === entry.programDayId)
            && (entry.slotIndex == null || log.slotIndex === entry.slotIndex)
            && (log.setIndex ?? 0) === index)
          if (stored) {
            set.logged = true
            set.logId = stored.id
            for (const key of ['weight', 'reps', 'timeSec', 'distance', 'perSide']) {
              if (stored[key] !== undefined) set[key] = stored[key]
            }
          } else if (set.logId && !liveLogIds.has(set.logId)) {
            set.logged = false
            set.logId = null
          }
        }
      }

      persistDraft()
      render()
    },

    destroy() {
      pauseElapsedTimer()
      clearInterval(ticker)
      ticker = undefined
      releaseWorkoutWakeLock()
      document.removeEventListener('visibilitychange', checkpointWhenHidden)
      window.removeEventListener('pagehide', checkpointOnPageHide)
      window.visualViewport?.removeEventListener('resize', syncHalfFoldViewport)
      window.visualViewport?.removeEventListener('scroll', syncHalfFoldViewport)
      window.removeEventListener('resize', syncHalfFoldViewport)
      weightWarningDialog?.close()
      document.removeEventListener('pointerdown',onOutsideMenuPointer,true)
      document.removeEventListener('keydown',onSessionKeydown)
      clearBodyOverlays()
    },
  }
}
