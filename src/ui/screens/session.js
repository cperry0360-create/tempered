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

/** What a home gym holds, per side. Editable from the EQUIPMENT pill. */
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
  let activeSince = null
  let wakeLock = null

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
    activeSince = activeSince ?? timeSource.now()
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
      activeSince,
    })
  }

  function checkpointWhenHidden() {
    if (document.visibilityState === 'hidden') persistDraft()
    else requestWorkoutWakeLock()
  }
  function checkpointOnPageHide() { persistDraft() }
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
    rest = { exerciseId: entry.exercise.id, endsAt: timeSource.now() + entry.restSec * 1000 }
    persistDraft()
    tick()
  }

  function tick() {
    const elapsed = root.querySelector('[data-session-elapsed]')
    if (elapsed && activeSince !== null) {
      elapsed.textContent = clock(Math.max(0, (timeSource.now() - activeSince) / 1000))
    }
    if (!rest) return
    const remaining = Math.max(0, (rest.endsAt - timeSource.now()) / 1000)
    const node = root.querySelector(`[data-rest="${rest.exerciseId}"]`)
    if (node) {
      node.textContent = remaining > 0 ? clock(remaining) : 'rested'
      // A live counter is a value worth noticing, and stops being one the
      // moment it stops counting.
      if (remaining > 0) node.dataset.acid = 'value'
      else delete node.dataset.acid
    }
    if (remaining <= 0) { rest = null; persistDraft() }
  }
  ticker = setInterval(tick, 500)

  // --- fields --------------------------------------------------------------

  /** Which two numbers a set has. A carry has no reps; a hold has no load. */
  function fieldsFor(exercise) {
    if (exercise?.metric === 'distance') {
      return [{ key: 'weight', label: 'LBS', mode: 'decimal' }, { key: 'distance', label: 'FEET', mode: 'numeric' }]
    }
    if (exercise?.unit === 'time') return [{ key: 'timeSec', label: 'SECS', mode: 'numeric' }, null]
    return [{ key: 'weight', label: 'LBS', mode: 'decimal' }, { key: 'reps', label: 'REPS', mode: 'numeric' }]
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

    if (!solution) {
      return el('div.plates', { dataset: { plates: entry.exercise.id } }, [
        el('span.plates__label', { text: 'PER SIDE' }),
        el('p.plates__note', { text: `${entry.barWeight} lb bar` }),
      ])
    }

    return el('div.plates', { dataset: { plates: entry.exercise.id } }, [
      el('span.plates__label', { text: 'PER SIDE' }),
      ...(solution.perSide.length === 0
        ? [el('span.plates__empty', { text: 'empty bar' })]
        : solution.perSide.map((plate) => el('span.plate', {
            dataset: { plate: String(plate) }, text: String(plate),
          }))),
      el('p.plates__note', { dataset: { exact: String(solution.exact) }, text: solution.note }),
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
    }
  }

  // --- set row -------------------------------------------------------------

  function setRow(entry, set, index) {
    const done = set.logged === true
    const active = !done && entry.sets.findIndex((s) => !s.logged) === index

    const inputs = fieldsFor(entry.exercise).map((field) => {
      if (!field) return el('span.setrow__num')
      return el('input.setrow__num', {
        type: 'text', inputmode: field.mode, value: set[field.key] ?? '',
        readOnly: done, 'aria-label': `${field.label}, set ${index + 1}`,
        dataset: { field: field.key, exercise: entry.exercise.id, set: String(index) },
        oninput: (event) => { set[field.key] = numberOrNull(event.target.value); persistDraft() },
        onfocus: (event) => markColumn(event.target, true),
        onblur: (event) => markColumn(event.target, false),
        onchange: (event) => {
          set[field.key] = numberOrNull(event.target.value)
          if (index === 0) cascade(entry, field.key, set[field.key])
          persistDraft()
          render()
        },
      })
    })

    const check = el('button.setrow__check', {
      type: 'button',
      'aria-label': done ? `Undo set ${index + 1}` : `Log set ${index + 1}`,
      dataset: {
        log: `${entry.exercise.id}:${index}`,
        done: String(done),
        ...(active ? { acid: 'active' } : {}),
      },
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

        for (const input of inputs) {
          if (input.dataset?.field) set[input.dataset.field] = numberOrNull(input.value)
        }
        const logged = {
          exerciseId: entry.exercise.id,
          method: activeMethod(entry),
          weight: set.weight ?? null, reps: set.reps ?? null,
          timeSec: set.timeSec ?? null, distance: set.distance ?? null,
          perSide: set.perSide === true,
          substitutedFor: entry.substitutedFor ?? null,
          programDayId: entry.programDayId ?? null,
          slotIndex: entry.slotIndex ?? null,
          setIndex: index,
        }
        const log = await workout.logSet(session, logged)
        // The stored record, not the object we sent: it carries `completedAt`,
        // which is what docs/11 F1 measures the session's duration from.
        loggedHere.push(log)
        set.logged = true
        set.logId = log.id
        render()
        startRest(entry)
      },
    }, [icon('check')])

    return el('div.setrow', {
      dataset: { done: String(done), active: String(active), editing: String(entry.editing === true) },
    }, [
      // The 4px acid bar down the left edge of the set being worked.
      active && el('span.setrow__edge', { dataset: { acid: 'active' } }),
      el('span.setrow__index', { text: String(index + 1) }),
      el('span.setrow__record', { text: performance(entry.last?.sets?.[index] ?? entry.last?.sets?.[0] ?? null) }),
      ...inputs,
      check,
      // Removing a set, which docs/09 B5 lists as missing. Behind EDIT SETS so
      // every control in the row keeps a 44px target.
      entry.editing === true && el('button.setrow__remove', {
        type: 'button', 'aria-label': `Remove set ${index + 1}`,
        dataset: { removeset: `${entry.exercise.id}:${index}` },
        onclick: async () => {
          if (set.logId) {
            await workout.removeSet(set.logId)
            loggedHere = loggedHere.filter((log) => log.id !== set.logId)
          }
          entry.sets.splice(index, 1)
          persistDraft()
          render()
        },
      }, [icon('minus')]),
      // Beside the weight field of the set actually being worked.
      active && isBarbell(entry) && plateStrip(entry, set),
    ])
  }

  // --- panels --------------------------------------------------------------

  function equipmentPanel(entry) {
    return el('div.panel', {}, [
      el('p.panel__note', { text: 'The bar, and the plates you have. The loading beside the weight follows this.' }),
      el('div.equipment', {}, [
        el('label.equipment__row', {}, [
          el('span.equipment__label', { text: 'BAR' }),
          el('input.equipment__bar', {
            type: 'text', inputmode: 'decimal', value: String(entry.barWeight),
            'aria-label': 'Bar weight',
            dataset: { barweight: entry.exercise.id },
            onchange: (event) => { entry.barWeight = numberOrNull(event.target.value) ?? 45; persistDraft(); render() },
          }),
        ]),
        el('div.equipment__row', {}, [
          el('span.equipment__label', { text: 'PLATES' }),
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
          ? 'Undo the checked sets before changing method. Logged work keeps the equipment it used.'
          : 'Same movement and program slot. Only the equipment and load history change.',
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
                : `No ${method.toLowerCase()} history yet. Your rep target stays the same.`,
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
      el('p.panel__note', { text: 'Swap in another movement. Your set structure is kept.' }),
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

  // --- the action pills ----------------------------------------------------

  function actionPill(entry, { name, label, glyph, onclick, value = null }) {
    return el('button.actionpill', {
      type: 'button',
      dataset: { [name]: entry.exercise.id, open: String(isOpen(entry, name)) },
      onclick,
    }, [
      icon(glyph),
      label,
      value,
    ])
  }

  function actionBar(entry) {
    return el('div.actions', { 'aria-label': 'Exercise actions' }, [
      // `data-rest="edit"` is kept: it is what the rest of the harnesses reach for.
      el('button.actionpill', {
        type: 'button',
        dataset: { rest: 'edit', restfor: entry.exercise.id, open: String(isOpen(entry, 'rest')) },
        onclick: () => togglePanel(entry, 'rest'),
      }, [
        icon('rest'),
        'REST',
        el('span.actionpill__value', { dataset: { rest: entry.exercise.id }, text: clock(entry.restSec) }),
      ]),
      actionPill(entry, {
        name: 'history', label: 'HISTORY', glyph: 'history',
        onclick: async () => {
          if (!entry.history) entry.history = await workout.exerciseHistory(entry.exercise.id, 6, activeMethod(entry))
          togglePanel(entry, 'history')
        },
      }),
      methodsForExercise(entry.exercise).length > 1 && actionPill(entry, {
        name: 'method', label: 'METHOD', glyph: 'equipment',
        value: el('span.actionpill__value', { text: activeMethod(entry).toUpperCase() }),
        onclick: () => togglePanel(entry, 'method'),
      }),
      actionPill(entry, {
        name: 'swap', label: 'SWAP', glyph: 'swap',
        onclick: () => togglePanel(entry, 'swap'),
      }),
      el('button.actionpill', {
        type: 'button',
        dataset: { editsets: entry.exercise.id, open: String(entry.editing === true) },
        onclick: () => { entry.editing = entry.editing !== true; persistDraft(); render() },
      }, [icon('sets'), entry.editing === true ? 'DONE EDITING' : 'EDIT SETS']),
      isBarbell(entry) && actionPill(entry, {
        name: 'equipment', label: 'PLATES', glyph: 'equipment',
        onclick: () => togglePanel(entry, 'equipment'),
      }),
    ])
  }

  // --- exercise card -------------------------------------------------------

  function exerciseCard(entry, position) {
    const best = entry.record?.bestWeight
    const slot = entry.slot
    const range = slot ? `${slot.sets} × ${slot.repMin}–${slot.repMax}${slot.perSide ? ' / side' : ''}` : null
    const fields = fieldsFor(entry.exercise)

    return el('section.card.exercise', {
      dataset: { exercise: entry.exercise.id, method: activeMethod(entry) ?? '' },
    }, [
      el('header.exercise__head', {}, [
        entry.exercise.art && el('button.exercise__art', {
          type: 'button', 'aria-label': `Show ${entry.exercise.name} reference`,
          dataset: { art: entry.exercise.id },
          onclick: () => togglePanel(entry, 'art'),
        }, [el('img.exercise__thumb', {
          src: artUrl(entry.exercise.art), alt: '', loading: 'lazy',
        })]),
        el('div.exercise__title', {}, [
          el('h2.exercise__name', { text: entry.exercise.movementName ?? entry.exercise.name }),
          range && el('p.exercise__range', { text: range }),
          methodsForExercise(entry.exercise).length > 1 && el('p.exercise__method', {
            text: `METHOD · ${activeMethod(entry).toUpperCase()}`,
          }),
          entry.substitutedFor && el('p.exercise__sub', {
            text: `swapped in for ${entry.substitutedFor.replace(/_/g, ' ')}`,
          }),
        ]),
        el('div.exercise__order', {}, [
          el('button.iconbutton', {
            type: 'button', 'aria-label': 'Move up', disabled: position === 0,
            dataset: { moveup: entry.exercise.id },
            onclick: () => { move(position, -1) },
          }, [icon('up')]),
          el('button.iconbutton', {
            type: 'button', 'aria-label': 'Move down', disabled: position === plan.length - 1,
            dataset: { movedown: entry.exercise.id },
            onclick: () => { move(position, 1) },
          }, [icon('down')]),
        ]),
      ]),

      (slot?.setup || slot?.cue) && el('p.exercise__cue', {
        text: [slot.setup, slot.cue].filter(Boolean).join(' · '),
      }),

      actionBar(entry),

      // Last performance and PR — with the PR's date, per docs/09 B6. A PR is a
      // value worth noticing, so it is one of the three things acid marks.
      el('div.exercise__history', {}, [
        el('span.pill', { dataset: { kind: 'last' } }, [
          el('span.pill__label', { text: 'LAST' }),
          el('span.pill__value', { text: entry.last ? performance(entry.last.sets[0]) : 'first time' }),
          entry.last && el('span.pill__aside', { text: since(entry.last.date, timeSource.today()) }),
        ]),
        el('span.pill', { dataset: { kind: 'pr' } }, [
          el('span.pill__label', { text: 'PR' }),
          el('span.pill__value', {
            dataset: best ? { acid: 'value' } : {},
            text: best ? lbs(best.weight) : '—',
          }),
          best && el('span.pill__unit', { text: 'lb' }),
          best && el('span.pill__aside', {
            dataset: best.date ? { prdate: '' } : {},
            text: `× ${best.reps}${best.date ? ` · ${shortDate(best.date)}` : ''}`,
          }),
        ]),
      ]),

      isOpen(entry, 'rest') && el('div.panel', {}, [
        el('p.panel__note', { text: 'Rest between sets. The timer never blocks the next set.' }),
        el('div.restedit', {}, [30, 60, 90, 120, 150, 180, 240].map((seconds) => el('button.restedit__option', {
          type: 'button', dataset: { restset: String(seconds), active: String(entry.restSec === seconds) },
          onclick: () => { entry.restSec = seconds; openPanel = null; persistDraft(); render() },
        }, [clock(seconds)]))),
      ]),

      isOpen(entry, 'history') && historyPanel(entry),
      isOpen(entry, 'method') && methodPanel(entry),
      isOpen(entry, 'swap') && swapPanel(entry),
      isOpen(entry, 'equipment') && equipmentPanel(entry),
      isOpen(entry, 'art') && el('div.panel.panel--art', {}, [
        el('img.exercise__full', { src: artUrl(entry.exercise.art), alt: entry.exercise.name }),
      ]),

      entry.proposal?.reason && el('p.exercise__proposal', { text: entry.proposal.reason }),

      el('div.setrow.setrow--head', { dataset: { editing: String(entry.editing === true) } }, [
        el('span.setrow__index', { text: 'SET' }),
        el('span.setrow__record', { text: 'LAST' }),
        ...fields.map((field) => el('span.setrow__col', {
          dataset: field ? { col: field.key } : {}, text: field?.label ?? '',
        })),
        el('span', { text: '' }),
        entry.editing === true && el('span', { text: '' }),
      ]),

      ...entry.sets.map((set, index) => setRow(entry, set, index)),

      el('button.addset', {
        type: 'button', dataset: { addset: entry.exercise.id },
        onclick: () => {
          const previous = entry.sets.at(-1)
          entry.sets.push({ weight: previous?.weight ?? null, reps: previous?.reps ?? null, logged: false })
          persistDraft()
          render()
        },
      }, [icon('plus'), 'ADD SET']),
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

  function render() {
    replace(root, [
      el('header.sessionbar', {}, [
        el('div', {}, [
          el('h1.sessionbar__title', { text: session?.title ?? 'Session' }),
          el('p.sessionbar__meta', {
            text: [session?.weekLabel, `${loggedCount()} sets logged`].filter(Boolean).join(' · '),
          }),
        ]),
        el('div.sessionbar__elapsed', { 'aria-label': 'Workout elapsed time' }, [
          el('span.sessionbar__elapsed-label', { text: 'ELAPSED' }),
          el('strong.sessionbar__elapsed-value', {
            dataset: { sessionElapsed: 'true' },
            text: clock(Math.max(0, (timeSource.now() - (activeSince ?? timeSource.now())) / 1000)),
          }),
        ]),
      ]),

      el('button.session-minimize', {
        type: 'button', dataset: { action: 'minimize-workout' },
        onclick: () => { persistDraft(); onMinimize?.() },
      }, [icon('minus'), 'MINIMIZE · KEEP WORKOUT OPEN']),

      session?.deload && el('p.deload', { text: 'Deload week. Hold the weight — this week is recovery, and it is half the work.' }),

      ...plan.map(exerciseCard),

      addingMovement
        ? addMovementPanel()
        : el('button.button.button--wide.session-add__open', {
            type: 'button', dataset: { action: 'add-movement' },
            onclick: () => { addingMovement = true; render(); requestAnimationFrame(() => root.querySelector('.session-add__search')?.focus()) },
          }, [icon('plus'), 'ADD MOVEMENT']),

      // FINISH lives below every set control, behind a confirm, because ending
      // a session by mis-tapping next to a checkmark is unacceptable. The tab
      // bar is hidden during a session, so the one primary action on this
      // screen is a full-width acid button rather than a FAB — and it is the
      // confirm that carries the acid, not the control that opens it.
      el('div.finishzone', {}, [
        confirmingFinish
          ? el('div.finishzone__confirm', {}, [
              el('p.finishzone__ask', { text: `Finish with ${loggedCount()} sets logged?` }),
              el('div.finishzone__pair', {}, [
                el('button.button', {
                  type: 'button', dataset: { action: 'cancel-finish' },
                  onclick: () => { confirmingFinish = false; render() },
                }, ['KEEP GOING']),
                el('button.button', {
                  type: 'button', dataset: { action: 'confirm-finish', acid: 'primary' }, onclick: finish,
                }, ['FINISH']),
              ]),
            ])
          : el('button.button.button--wide', {
              type: 'button', dataset: { action: 'finish' },
              onclick: () => { confirmingFinish = true; render() },
            }, ['FINISH SESSION']),
      ]),
    ])
    tick()
  }

  async function finish() {
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
      activeSince = timeSource.now()
      activateWorkoutScreen()
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      plan = []
      loggedHere = []
      isFirstOfDay = true

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
      activeSince = Number.isFinite(draft.activeSince) ? draft.activeSince : timeSource.now()
      activateWorkoutScreen()
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      session = { ...draft.session }
      plan = Array.isArray(draft.plan) ? draft.plan : []
      isFirstOfDay = draft.isFirstOfDay !== false
      openPanel = draft.openPanel ?? null
      confirmingFinish = false
      addingMovement = false
      addQuery = ''
      rest = draft.rest && Number(draft.rest.endsAt) > timeSource.now() ? { ...draft.rest } : null

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
      clearInterval(ticker)
      ticker = undefined
      releaseWorkoutWakeLock()
      document.removeEventListener('visibilitychange', checkpointWhenHidden)
      window.removeEventListener('pagehide', checkpointOnPageHide)
    },
  }
}
