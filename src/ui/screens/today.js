/**
 * TODAY — what is outstanding right now.
 *
 * Two kinds of outstanding work share this screen:
 *
 *   - **Training**, from `docs/10-task-model.md`: the day's prescribed exercise
 *     slots, each independently completable without starting a session.
 *   - **Daily**, from Phase 4 and `docs/03-screens.md`: the activities this
 *     person tracks every day. One tap for a mark, one number plus one tap for
 *     a measurement.
 *
 * `docs/11-structure-and-feel.md` rebuilt the shape of it. The list used to read
 * as a spreadsheet — every row the same object, nothing telling a heavy compound
 * lift apart from a glass of water. Four things fix that, and they are all here:
 *
 *   - **A (tiles).** Every row opens with a 32px icon tile in its attribute's
 *     colour. Colour is what makes a list scannable: you find sleep by its
 *     violet, not by reading six labels.
 *   - **B (sections).** TRAIN, RECOVER, SHARPEN, each with a completion count.
 *   - **C (acknowledgement).** Something happens when you log — the ring
 *     completes, the XP floats up in the attribute's colour, the phone ticks.
 *   - **D (progress first).** A summary strip answers "how is today going"
 *     before you read a single row.
 *
 * Only the daily list is on the screen. Everything else in the catalogue is
 * behind one control, which is what makes the one-view rule structural: Today
 * fits a phone because of what it shows, not because the catalogue happens to
 * be short. Adding a fortieth activity cannot break it.
 *
 * There is no overdue state anywhere in here, and there must never be one.
 * Outstanding is outstanding: nothing is late, nothing is missed, nothing turns
 * red. An unfinished slot is neutral until the week ends, and then it is simply
 * gone. Absence is not failure.
 *
 * Rest day is the first thing in RECOVER and never anywhere else. It is an
 * action that earns, and burying it under twelve other rows would say the
 * opposite of what the app is for.
 */

import { el, replace } from '../dom.js'
import { icon, iconForActivity } from '../icons.js'
import { xp as formatXp } from '../format.js'
import { ATTRIBUTE_IDS } from '../../domain/tiers.js'
import { totalsByAttributeFromSources } from '../../domain/xp-engine.js'

/**
 * The three sections of a day, and what lands in each.
 *
 * `docs/11 B` names TRAIN as the program slots, RECOVER as "sleep, water, food,
 * rest, body", and SHARPEN as "reading, study, meditation, music" — every
 * Vitality activity and every Mind activity respectively. That leaves the two
 * Wind activities, steps and mobility, unnamed.
 *
 * They go at the end of RECOVER, and TRAIN stays exactly what the doc says it
 * is: today's program slots. Putting them in TRAIN was tried first and was
 * wrong twice over — it made steps the first daily action on the screen, where
 * `docs/03` requires rest day to be, and it stretched "today's program slots"
 * to mean something else. Incidental daily movement belongs with the things
 * that keep the body going rather than with the prescription. Judgement call,
 * recorded in DECISIONS.md.
 */
const SECTIONS = [
  { id: 'train', title: 'TRAIN', attributes: [] },
  { id: 'recover', title: 'RECOVER', attributes: ['vitality', 'wind'] },
  { id: 'sharpen', title: 'SHARPEN', attributes: ['mind'] },
]

/**
 * Quick-add amounts for the things that arrive in pieces. `docs/11 F3`: nobody
 * knows their daily ounces, they drink a glass.
 *
 * Only for activities whose spec is `mode: 'add'`. A `replace` activity — sleep,
 * steps, a body metric — describes the whole day already, and adding eight to it
 * would be nonsense.
 */
const QUICK_ADD = {
  water: [8, 12, 16],
  read: [10, 20, 30],
  study: [10, 20, 30],
  meditate: [5, 10, 20],
  instrument: [10, 20, 30],
  mobility: [5, 10, 15],
}

/**
 * The quick-add amounts for an activity, or null.
 *
 * Only `mode: 'add'` activities qualify: a `replace` activity describes the
 * whole day already, and adding eight to a night's sleep is nonsense.
 */
function quickAddFor(activity) {
  return activity.spec?.mode === 'add' ? QUICK_ADD[activity.id] ?? null : null
}

/** The unit a row asks for, short enough to sit beside its name. */
function unitLabel(activity) {
  if (activity.id === 'body_metrics') return 'lb'
  // "STEPS" already says what it counts; a unit beside it is noise.
  return { hours: 'h', min: 'min', oz: 'oz' }[activity.unit] ?? ''
}

/** How a logged value reads back, per unit. */
function valueLabel(activity, value) {
  if (value === true || value === null || value === undefined) return 'logged'
  const unit = activity.unit === 'hours' ? 'h'
    : activity.unit === 'min' ? 'min'
      : activity.unit === 'oz' ? 'oz'
        : activity.unit === 'steps' ? 'steps'
          : activity.id === 'body_metrics' ? 'lb' : ''
  return `${value}${unit ? ` ${unit}` : ''}`
}

/**
 * How full an activity's ring sits, 0 to 1.
 *
 * A cap or a target band gives a real fraction to draw. Everything else is a
 * thing you did or have not yet, and a half-filled ring would be inventing a
 * quota the app does not hold — which is how a tracker starts feeling like a
 * debt collector.
 */
function fillOf(activity) {
  const target = activity.dailyCap ?? activity.band?.[0] ?? null
  const value = typeof activity.value === 'number' ? activity.value : null
  if (target && value !== null) return Math.max(0, Math.min(1, value / target))
  return activity.logged ? 1 : 0
}

/**
 * The progress ring, drawn around whatever control completes the row.
 *
 * @param {number} fill 0 to 1
 */
function ring(fill) {
  const R = 15
  const circumference = 2 * Math.PI * R
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'ring')
  svg.setAttribute('viewBox', '0 0 34 34')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const cls of ['ring__track', 'ring__fill']) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    c.setAttribute('class', cls)
    c.setAttribute('cx', '17')
    c.setAttribute('cy', '17')
    c.setAttribute('r', String(R))
    if (cls === 'ring__fill') {
      c.setAttribute('stroke-dasharray', String(circumference))
      c.setAttribute('stroke-dashoffset', String(circumference * (1 - Math.max(0, Math.min(1, fill)))))
    }
    svg.append(c)
  }
  return svg
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {ReturnType<import('../../app/daily.js').createDailyService>} deps.daily
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(options: object) => void} deps.onStart
 * @param {(slot: object) => void} deps.onOpenSlot
 */
export function createTodayScreen({ workout, daily, clock, onStart, onOpenSlot }) {
  const root = el('div.screen.screen--today')
  /** @type {any} */ let today = null
  /** @type {any} */ let day = null
  /** Per-attribute XP earned today, day activities and training together. */
  /** @type {Record<string, number>} */ let movedToday = {}
  /** What the last entry earned, shown once beside the thing that earned it. */
  /** @type {{id: string, xp: number, attribute: string|null, levelled: string|null}|null} */
  let justEarned = null
  /** Sections that completed on the last log, for one flash each. */
  /** @type {Set<string>} */ let flashed = new Set()
  /** The day finishing is one modest beat, shown once. */
  let dayBeat = false
  let workedOpen = false
  let otherOpen = false

  // --- rows -----------------------------------------------------------------

  /** The icon tile that opens every row. Colour identifies the attribute. */
  function tile(attribute, glyph) {
    return el('span.tile', { dataset: { attribute } }, [icon(glyph)])
  }

  /**
   * The XP acknowledgement, in the attribute's colour, anchored to the row that
   * earned it rather than to the top of the screen. `docs/11 C`.
   */
  function floatFor(id) {
    if (!justEarned || justEarned.id !== id || justEarned.xp <= 0) return null
    return el('span.float', {
      dataset: { attribute: justEarned.attribute ?? 'grit' },
      text: `+${formatXp(justEarned.xp)}`,
    })
  }

  function slotRow(task, programDay) {
    const fill = task.slot.sets > 0 ? task.logged / task.slot.sets : (task.done ? 1 : 0)
    return el('button.row.task', {
      type: 'button',
      dataset: {
        task: task.key, done: String(task.done), started: String(task.started),
        justlogged: String(justEarned?.id === task.key),
      },
      onclick: () => onOpenSlot({
        dayId: programDay.id,
        slotIndex: task.index,
        exerciseId: task.slot.exerciseId,
        slot: task.slot,
        alreadyLogged: task.logged,
      }),
    }, [
      tile('might', 'train'),
      el('span.row__name', { text: task.slot.name }),
      el('span.row__value.task__pres', {
        // "2 of 4" while in progress. Never "2 short", never a countdown.
        text: task.done ? 'done'
          : task.started ? `${task.logged} of ${task.slot.sets}`
            : `${task.slot.sets} × ${task.slot.repMin}–${task.slot.repMax}${task.slot.perSide ? ' /side' : ''}`,
      }),
      el('span.row__act', {}, [ring(fill), task.done && icon('check')]),
      floatFor(task.key),
    ])
  }

  /**
   * The typed amount, for when the glass is not 8, 12 or 16 ounces.
   *
   * `docs/11 F3` asks for "a manual field for correction" beside the quick-add
   * buttons. It adds, exactly as the buttons do, because the activity's own
   * spec says `mode: 'add'` — see DECISIONS.md for what that does not yet
   * allow, which is correcting a total downwards.
   */
  function amountField(activity) {
    const input = el('input.entry__value', {
      type: 'text', inputmode: 'decimal',
      // It sets the day's total, so say so: "add to" would be a lie about what
      // pressing it does, and this is the control people reach for when a
      // number is already wrong.
      'aria-label': `${activity.name} total for today${activity.unit ? `, ${activity.unit}` : ''}`,
      placeholder: 'total',
      dataset: { entry: activity.id },
      onkeydown: (event) => {
        if (event.key === 'Enter') { event.preventDefault(); record(activity, input.value, { mode: 'set' }) }
      },
    })
    return el('span.entry__field', {}, [input])
  }

  /**
   * How a typed entry combines. A field is a correction wherever the activity
   * also offers quick-add: the buttons are how you accumulate, so the number
   * you type is the total you mean. Everything else keeps its own mode.
   */
  const entryMode = (activity) => (quickAddFor(activity) ? { mode: 'set' } : {})

  /** The quick-add strip: `docs/11 F3`, for anything that arrives in pieces. */
  function quickAdd(activity) {
    return el('span.quick', {}, quickAddFor(activity).map((amount) => el('button.quick__add', {
      type: 'button',
      'aria-label': `Add ${amount} ${activity.unit ?? ''} to ${activity.name}`,
      dataset: { quickadd: `${activity.id}:${amount}` },
      onclick: () => record(activity, String(amount)),
    }, [`+${amount}`])))
  }

  /** A mark: one tap, and it is logged. */
  function markRow(activity) {
    return el('div.row.mark', {
      dataset: {
        activity: activity.id, kind: 'mark', rest: String(activity.id === 'rest_day'),
        justlogged: String(justEarned?.id === activity.id),
      },
    }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      el('span.row__name', { text: activity.name }),
      el('button.row__act', {
        type: 'button',
        title: activity.help ?? activity.name,
        'aria-label': `Log ${activity.name}`,
        dataset: { log: activity.id, kind: 'mark' },
        onclick: () => record(activity, null),
      }, [ring(activity.logged ? 1 : 0), icon(activity.id === 'rest_day' ? 'rest' : 'check')]),
      floatFor(activity.id),
    ])
  }

  /**
   * A measurement: the field is already there, so logging is the number and one
   * tap. Nothing to open first — logging speed is non-negotiable 1, and it
   * survives the redesign untouched.
   */
  function entryRow(activity) {
    const input = el('input.entry__value', {
      type: 'text', inputmode: 'decimal',
      'aria-label': `${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,
      dataset: { entry: activity.id },
      onkeydown: (event) => {
        if (event.key === 'Enter') { event.preventDefault(); record(activity, input.value, entryMode(activity)) }
      },
    })

    return el('div.row.entry', {
      dataset: {
        activity: activity.id, kind: 'number',
        justlogged: String(justEarned?.id === activity.id),
      },
    }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      el('span.row__name', {}, [
        activity.short ?? activity.name,
        // The unit is a footnote beside the name, at half the size and dimmed —
        // it is not worth a line of its own on a screen this dense. Dropped
        // where quick-add buttons already say it: "+8 +12 +16" is the unit.
        !quickAddFor(activity) && el('span.entry__unit', { text: unitLabel(activity) }),
      ]),
      // Things that arrive in pieces get quick-add buttons rather than mental
      // arithmetic. docs/11 F3.
      ...(quickAddFor(activity) ? [quickAdd(activity)] : []),
      el('span.entry__field', {}, [input]),
      el('button.row__act.entry__confirm', {
        type: 'button', 'aria-label': `Log ${activity.name}`,
        dataset: { log: activity.id, kind: 'number' },
        onclick: () => record(activity, input.value, entryMode(activity)),
      }, [ring(fillOf(activity)), icon('check')]),
      floatFor(activity.id),
    ])
  }

  /**
   * A logged item: evidence, not a control.
   *
   * Rendered in place in its own section for the render right after logging, so
   * `docs/11 C`'s acknowledgement — the ring completing, the XP floating up —
   * plays where the thing happened. It is already a worked row by then, not an
   * outstanding one: Phase 4 requires that logging something takes it out of
   * the outstanding list, and it does. Only the animation stays behind.
   */
  function workedRow(activity) {
    const justLogged = justEarned?.id === activity.id
    // A thing that arrives in pieces is never finished for the day: you drink
    // another glass. Keeping quick-add and the field on the logged row is what
    // makes that possible without hunting for the row again — otherwise the
    // first +8 takes the controls off screen with it.
    const piecewise = quickAddFor(activity)
    const field = piecewise ? amountField(activity) : null
    const input = field?.querySelector('input')

    return el('div.row.row--worked', {
      dataset: { worked: activity.id, justlogged: String(justLogged) },
    }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      el('span.row__name', { text: activity.name }),
      el('span.row__value', { text: valueLabel(activity, activity.value) }),
      ...(piecewise ? [quickAdd(activity), field] : []),
      // The correction needs a real button. A numeric keypad has no Enter key
      // worth relying on, and a field you can type into but not commit is a
      // control that only works on a desktop keyboard.
      piecewise
        ? el('button.row__act', {
            type: 'button', 'aria-label': `Set ${activity.name} total for today`,
            dataset: { log: activity.id, kind: 'correction' },
            onclick: () => record(activity, input.value, { mode: 'set' }),
          }, [ring(1), icon('check')])
        : el('span.row__act', {}, [ring(1), icon('check')]),
      justLogged && floatFor(activity.id),
    ])
  }

  /**
   * @param {any} activity
   * @param {string|number|null} value
   * @param {{mode?: 'add'|'set'}} [options] `{mode:'set'}` corrects a total
   *   rather than adding to it — the typed field, never the quick-add buttons.
   */
  async function record(activity, value, options = {}) {
    const id = typeof activity === 'string' ? activity : activity.id
    const attribute = typeof activity === 'string' ? null : activity.attribute
    const before = sectionCompletion()
    const wasDayDone = dayIsWorked()

    const result = await daily.log(id, value, options)
    const earned = Object.values(result.xpByAttribute ?? {}).reduce((sum, n) => sum + n, 0)
    justEarned = {
      id,
      xp: earned,
      attribute,
      levelled: result.levelledUp?.[0]
        ? `${result.levelledUp[0].attribute} reached ${result.levelledUp[0].tier}`
        : null,
    }

    // A short tick, where the device has one. Never a sound, never a banner.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(10) } catch { /* a refused vibration is not an error */ }
    }

    await reload()

    // Flash only the sections that finished on THIS log, and only once.
    const after = sectionCompletion()
    flashed = new Set(SECTIONS
      .filter(({ id: sid }) => after[sid]?.complete && !before[sid]?.complete)
      .map(({ id: sid }) => sid))
    dayBeat = !wasDayDone && dayIsWorked()
    if (flashed.size > 0 || dayBeat) render()
    if (dayBeat) setTimeout(() => { dayBeat = false; render() }, 1400)
  }

  // --- structure ------------------------------------------------------------

  /** Which outstanding and logged items belong to each section. */
  function sectionContents() {
    const tasks = today?.tasks ?? []
    const outstanding = (day?.outstanding ?? []).filter((activity) => activity.daily)
    const logged = day?.logged ?? []
    return SECTIONS.map((section) => {
      const belongs = (a) => section.attributes.includes(a.attribute)
      return {
        ...section,
        slots: section.id === 'train' ? tasks : [],
        outstanding: outstanding.filter(belongs),
        logged: logged.filter(belongs),
      }
    })
  }

  function sectionCompletion() {
    /** @type {Record<string, {done: number, total: number, complete: boolean}>} */
    const out = {}
    for (const s of sectionContents()) {
      const done = s.slots.filter((t) => t.done).length + s.logged.length
      const total = s.slots.length + s.logged.length + s.outstanding.length
      out[s.id] = { done, total, complete: total > 0 && done === total }
    }
    return out
  }

  const dayIsWorked = () => {
    const completion = sectionCompletion()
    const live = SECTIONS.filter(({ id }) => completion[id].total > 0)
    return live.length > 0 && live.every(({ id }) => completion[id].complete)
  }

  // --- the summary strip, docs/11 D -----------------------------------------

  /**
   * How today is going, before a single row is read.
   *
   * The day's XP and five bars showing what has moved. The bars are scaled to
   * the largest of them rather than to a target: there is no daily quota in this
   * app and inventing one to draw a bar against would be the same mistake as an
   * overdue state.
   */
  function summaryStrip() {
    const moved = movedToday
    const total = Object.values(moved).reduce((sum, n) => sum + (n ?? 0), 0)
    const peak = Math.max(1, ...ATTRIBUTE_IDS.map((id) => moved[id] ?? 0))
    return el('section.strip', { dataset: { worked: String(dayIsWorked()) } }, [
      el('div.strip__head', {}, [
        el('span.strip__label', { text: 'TODAY' }),
        el('span.strip__xp', { dataset: { acid: 'value' }, text: total > 0 ? `+${formatXp(total)}` : '—' }),
      ]),
      el('div.strip__bars', {}, ATTRIBUTE_IDS.map((id) => el('span.strip__bar', {
        dataset: { attribute: id, moved: String((moved[id] ?? 0) > 0) },
        title: `${id}: ${formatXp(moved[id] ?? 0)} XP today`,
      }, [
        el('span.strip__fill', {
          style: `height:${Math.round(((moved[id] ?? 0) / peak) * 100)}%`,
        }),
      ]))),
    ])
  }

  // --- screen ---------------------------------------------------------------

  /** Marks before measurements — one tap before one number plus one tap. */
  function rowsFor(list) {
    const marks = list.filter((activity) => activity.spec?.entry === 'mark')
    const entries = list.filter((activity) => activity.spec?.entry === 'number')
    return [...marks.map(markRow), ...entries.map(entryRow)]
  }

  function render() {
    const sections = sectionContents()
    const completion = sectionCompletion()
    const other = (day?.outstanding ?? []).filter((activity) => !activity.daily)
    const workedCount = Object.values(completion).reduce((sum, c) => sum + c.done, 0)

    replace(root, [
      el('h1.screen__title', { text: 'Today' }),

      summaryStrip(),

      // What the last entry earned takes the framing line's place rather than a
      // line of its own: the screen must not grow as you log things, or the
      // bottom of the list walks off the bottom of the phone.
      justEarned
        ? el('p.earned', { dataset: { earned: justEarned.id } }, [
            el('span.earned__xp', { dataset: { acid: 'value' }, text: `+${formatXp(justEarned.xp)}` }),
            el('span.earned__what', {
              text: justEarned.levelled ? `XP · ${justEarned.levelled}` : 'XP logged',
            }),
          ])
        // Only when there is no program: with one active, the TRAIN heading
        // already carries the count and the strip already answers "how is today
        // going". Two lines saying the same thing cost a row of the one view.
        : !today && el('p.today__frame', { text: 'No program is active. Start one from Train.' }),

      ...sections.map((section) => {
        // The row that was just logged stays where it happened for one render.
        // docs/11 C puts the acknowledgement ON the row — the ring completing,
        // the XP floating up — and without this the row leaves for the collapsed
        // "worked" list in the very same beat, so the one thing the section is
        // for never appears.
        const justLogged = section.logged.filter((a) => a.id === justEarned?.id)
        const rows = [
          ...section.slots.filter((t) => !t.done).map((t) => slotRow(t, today.day)),
          ...rowsFor(section.outstanding),
          ...justLogged.map(workedRow),
        ]
        if (rows.length === 0 && completion[section.id].total === 0) return null
        return el('section.block.sect', { dataset: { section: section.id } }, [
          el('h2.block__title.sect__title', {
            dataset: { flash: String(flashed.has(section.id)), complete: String(completion[section.id].complete) },
          }, [
            section.title,
            el('span.sect__count', {
              text: `${completion[section.id].done} of ${completion[section.id].total}`,
            }),
          ]),
          rows.length > 0
            ? el('div.rows', {}, rows)
            : el('p.block__hint', { text: 'All worked through.' }),
        ])
      }),

      // Everything off the daily list, one control away. Not a menu of
      // settings — the same rows, logged the same way.
      other.length > 0 && el('section.block', {}, [
        el('button.elsewhere__toggle', {
          type: 'button', dataset: { other: 'toggle', open: String(otherOpen) },
          onclick: () => { otherOpen = !otherOpen; render() },
        }, [icon(otherOpen ? 'up' : 'down'), 'LOG SOMETHING ELSE']),
        otherOpen && el('div.elsewhere', {}, [el('div.rows', {}, rowsFor(other))]),
      ]),

      workedCount > 0 && el('section.block', {}, [
        el('button.worked__toggle', {
          type: 'button', dataset: { worked: 'toggle', open: String(workedOpen) },
          onclick: () => { workedOpen = !workedOpen; render() },
        }, [icon('check'), `${workedCount} WORKED TODAY`]),

        // A finished slot stays a task, not a receipt: `docs/10` makes the slot
        // the unit, and a slot you have already worked is still one you can
        // open and add a set to. Only the daily activities become plain rows.
        workedOpen && el('div.rows.worked', {}, [
          ...sections.flatMap((s) => s.slots.filter((t) => t.done).map((t) => slotRow(t, today.day))),
          ...sections.flatMap((s) => s.logged.filter((a) => a.id !== justEarned?.id).map(workedRow)),
        ]),
      ]),

      // The day finishing is one beat, not a modal with a button to dismiss.
      dayBeat && el('div.daybeat', { 'aria-hidden': 'true' }, [
        el('span.daybeat__word', { text: 'TEMPERED' }),
      ]),
    ])
  }

  async function reload() {
    today = await workout.todayTasks()
    day = await daily.today()

    // What moved today comes from two ledgers: the day log records what the
    // day's own activities paid, the sessions record what training paid.
    const fromDay = totalsByAttributeFromSources(day?.day?.awarded ?? {})
    const fromTraining = await workout.xpToday()
    movedToday = Object.fromEntries(ATTRIBUTE_IDS
      .map((id) => [id, (fromDay[id] ?? 0) + (fromTraining[id] ?? 0)]))

    render()
  }

  /** Arriving at the screen clears the last entry's acknowledgement. */
  async function refresh() {
    justEarned = null
    flashed = new Set()
    dayBeat = false
    await reload()
  }

  return {
    root,

    /**
     * The one primary action on this screen: work the whole day in one go.
     *
     * It is the FAB in the floating bar rather than a full-width button at the
     * end of the list, per `docs/04-design-system.md` — a screen whose content
     * is a list of individually startable slots should not end in a button that
     * looks like the way to start them.
     */
    primary() {
      if (!today) return null
      return {
        label: `Run ${today.day.name}`,
        icon: 'play',
        dataset: { startday: today.day.id },
        run: () => onStart({ programDay: today.day }),
      }
    },

    refresh,
  }
}
