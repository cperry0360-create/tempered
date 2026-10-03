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
import { icon } from '../icons.js'
import { lbs, performance, clock, since, shortDate } from '../format.js'
import { solvePlates } from '../../domain/plates.js'
import { methodForExercise, methodsForExercise } from '../../domain/exercise-method.js'
import { clearActiveSessionDraft, saveActiveSessionDraft } from '../session-draft.js'

/** Art lives beside the repo root; resolve against this module so the path holds
 *  wherever the document lives — the app root, /tempered/, or a test harness. */
const artUrl = (file) => new URL(`../../../art/exercises/${file}`, import.meta.url).href

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
export function createSessionScreen({ workout, clock: timeSource, onFinish, onMinimize }) {
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
  let ticker
  let elapsedSec = 0
  let activeSince = null
  let wakeLock = null
  let hasUnloggedEdits = false
  let confirmingDiscard = false

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

  function persistDraft() {
    if (!session) return
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
    })
  }

  function checkpointWhenHidden() {
    if (document.visibilityState === 'hidden') {
      pauseElapsedTimer()
      persistDraft()
      releaseWorkoutWakeLock()
    } else {
      activateWorkoutScreen()
    }
  }
  function checkpointOnPageHide() {
    pauseElapsedTimer()
    persistDraft()
    releaseWorkoutWakeLock()
  }
  document.addEventListener('visibilitychange', checkpointWhenHidden)
  window.addEventListener('pagehide', checkpointOnPageHide)

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
      onclick: async () => {
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
        const log = await workout.logSet(session, logged)
        loggedHere.push(log)
        set.logged = true
        set.logId = log.id
        hasUnloggedEdits = false
        render()
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
          onclick: () => {
            persistDraft()
            clearBodyOverlays()
            onMinimize?.()
          },
        }, ['Minimize workout']),
        item('Move up', () => move(position, -1), { disabled: position === 0 }),
        item('Move down', () => move(position, 1), { disabled: position === plan.length - 1 }),
        item('Remove exercise', () => removeExercise(entry), { disabled: entry.sets.some((set) => set.logged) }),
      ].filter(Boolean)),
    ])
  }

  // --- exercise card -------------------------------------------------------

  function exerciseCard(entry, position) {
    const slot = entry.slot
    const range = slot
      ? `${slot.sets} × ${slot.repMin}–${slot.repMax}`
      : `${entry.sets.length} sets`
    const coaching = entry.proposal?.reason || slot?.cue || slot?.setup || ''
    const best = entry.record?.bestWeight
    const fields = fieldsFor(entry.exercise)

    return el('section.card.exercise.exercise--r3', {
      dataset: { exercise: entry.exercise.id, method: activeMethod(entry) ?? '' },
    }, [
      el('header.exercise__head', { dataset: { hasArt: String(Boolean(entry.exercise.art)) } }, [
        entry.exercise.art && el('button.exercise__art', {
          type: 'button',
          'aria-label': `Show ${entry.exercise.name} reference`,
          dataset: { art: entry.exercise.id },
          onclick: () => togglePanel(entry, 'art'),
        }, [el('img.exercise__thumb', {
          src: artUrl(entry.exercise.art), alt: '', loading: 'lazy',
        })]),
        el('div.exercise__title', {}, [
          el('h2.exercise__name', { text: displayName(entry.exercise, entry.slot) }),
          el('button.exercise__range', {
            type: 'button',
            onclick: () => { openPanel = panelKey(entry, 'rest'); render() },
            text: `${range} · Rest ${clock(entry.restSec)}`,
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
      el('div.swaplist', {}, choices.length
        ? choices.map((exercise) => el('button.swaplist__option', {
            type: 'button', dataset: { addExercise: exercise.id },
            onclick: () => addMovement(exercise),
          }, [exercise.name]))
        : [el('p.panel__note', { text: query ? 'No matching unused movements.' : 'Every movement is already in this workout.' })]),
    ])
  }

  function restBar() {
    if (!rest) return null
    const remaining = Math.max(0, (Number(rest.endsAt) - timeSource.now()) / 1000)
    return el('div.session-restbar', { dataset: { restBar: 'true', sessionRestOverlay: 'true', sessionOverlay: 'true' } }, [
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

  /** The rest bar and confirmation sheets live on <body>, outside the screen:
   *  iOS makes the scrolling app body its own stacking context, so a sheet left
   *  inside it can never rise above the body-level rest bar. */
  function clearBodyOverlays() {
    document.querySelectorAll('[data-session-overlay]').forEach((node) => node.remove())
  }

  function cancelWorkout() {
    if (hasUnloggedEdits) {
      confirmingDiscard = true
      render()
      return
    }
    clearActiveSessionDraft()
    releaseWorkoutWakeLock()
    onFinish(null)
  }

  function render() {
    replace(root, [
      el('header.sessionbar.sessionbar--r3', {}, [
        el('button.sessionbar__cancel', {
          type: 'button',
          dataset: { action: 'cancel-session' },
          onclick: cancelWorkout,
        }, ['Cancel']),
        el('div.sessionbar__center', {}, [
          el('h1.sessionbar__title', { text: session?.title ?? 'Session' }),
          el('span.sessionbar__elapsed-value', {
            dataset: { sessionElapsed: 'true' },
            text: clock(elapsedSeconds()),
          }),
        ]),
        el('button.sessionbar__finish', {
          type: 'button',
          dataset: { action: 'finish' },
          onclick: () => { confirmingFinish = true; render() },
        }, ['Finish']),
      ]),

      session?.deload && el('p.deload', { text: 'Deload week. Hold the weight — recovery is half the work.' }),
      ...plan.map(exerciseCard),

      addingMovement
        ? addMovementPanel()
        : el('button.button.button--wide.session-add__open', {
            type: 'button', dataset: { action: 'add-movement' },
            onclick: () => {
              addingMovement = true
              render()
              requestAnimationFrame(() => root.querySelector('.session-add__search')?.focus())
            },
          }, [icon('plus'), 'Add movement']),

    ])
    clearBodyOverlays()
    if (rest) document.body.append(restBar())
    const sheet = confirmingFinish ? finishSheet() : confirmingDiscard ? discardSheet() : null
    if (sheet) document.body.append(sheet)
    tick()
  }

  function finishSheet() {
    return el('div.session-sheet', { dataset: { sessionOverlay: 'true' } }, [
      el('div.session-sheet__card', {}, [
        el('p.session-sheet__title', { text: `Finish with ${loggedCount()} ${loggedCount() === 1 ? 'set' : 'sets'} logged?` }),
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
        el('p.session-sheet__title', { text: 'Discard unlogged edits?' }),
        el('p.session-sheet__copy', { text: 'Checked sets stay in your log. Unchecked changes will be discarded.' }),
        el('div.session-sheet__actions', {}, [
          el('button', {
            type: 'button',
            onclick: () => { confirmingDiscard = false; render() },
          }, ['Keep editing']),
          el('button', {
            type: 'button',
            dataset: { confirmAction: 'discard' },
            onclick: () => {
              clearBodyOverlays()
              clearActiveSessionDraft()
              releaseWorkoutWakeLock()
              onFinish(null)
            },
          }, ['Discard']),
        ]),
      ]),
      ])
  }

  async function finish() {
    clearBodyOverlays()
    const summary = await workout.finishSession(session, {
      isFirstOfDay,
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

    /**
     * @param {object} options
     * @param {object|null} [options.routine]
     * @param {object|null} [options.programDay]  A day from the active program.
     * @param {string|null} [options.exerciseId]  For an ad-hoc single exercise.
     */
    async start({ routine = null, programDay = null, exerciseId = null, slotTask = null, returnTab = 'today' }) {
      elapsedSec = 0
      activeSince = null
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
            sets: prepared.proposal.sets.map((set) => ({ ...set, logged: false, logId: null })),
          })
        }
      }
      session.returnTab = returnTab
      persistDraft()
      render()
    },

    async resume(draft) {
      // Old checkpoints stored an absolute start time, so time spent with the
      // app closed inflated the workout into hundreds of minutes. Missing
      // elapsedSec is intentionally treated as zero rather than repeating it.
      elapsedSec = Number.isFinite(draft.elapsedSec) ? Math.max(0, draft.elapsedSec) : 0
      activeSince = null
      activateWorkoutScreen()
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      session = { ...draft.session }
      plan = Array.isArray(draft.plan) ? draft.plan : []
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
      clearBodyOverlays()
    },
  }
}
