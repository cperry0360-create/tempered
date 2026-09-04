/**
 * TODAY — what is outstanding right now.
 *
 * Two kinds of outstanding work share this screen:
 *
 *   - **Training**, from `docs/10-task-model.md`: the day's prescribed exercise
 *     slots, each independently completable without starting a session.
 *   - **Daily**, from Phase 4 and `docs/03-screens.md`: sleep, fuel, movement,
 *     stillness. One tap for a mark, one number plus one tap for a measurement.
 *
 * There is no overdue state anywhere in here, and there must never be one.
 * Outstanding is outstanding: nothing is late, nothing is missed, nothing turns
 * red. An unfinished slot is neutral until the week ends, and then it is simply
 * gone. Absence is not failure.
 *
 * Rest day is the first thing in the daily list and never anywhere else. It is
 * an action that earns, and burying it under twelve other rows would say the
 * opposite of what the app is for.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { xp as formatXp } from '../format.js'

/** The unit a tile asks for, short enough to sit beside its name. */
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
  /** What the last entry earned, shown once beside the thing that earned it. */
  /** @type {{id: string, xp: number, levelled: string|null}|null} */ let justEarned = null
  let workedOpen = false

  // --- training -------------------------------------------------------------

  function slotRow(task, programDay) {
    return el('button.task', {
      type: 'button',
      dataset: { task: task.key, done: String(task.done), started: String(task.started) },
      onclick: () => onOpenSlot({
        dayId: programDay.id,
        slotIndex: task.index,
        exerciseId: task.slot.exerciseId,
        slot: task.slot,
        alreadyLogged: task.logged,
      }),
    }, [
      el('span.task__mark', {}, [task.done && icon('check')]),
      el('span.task__name', { text: task.slot.name }),
      el('span.task__pres', {
        // "2 of 4" while in progress. Never "2 short", never a countdown.
        text: task.done ? 'done'
          : task.started ? `${task.logged} of ${task.slot.sets}`
            : `${task.slot.sets} × ${task.slot.repMin}–${task.slot.repMax}${task.slot.perSide ? ' /side' : ''}`,
      }),
    ])
  }

  // --- daily ----------------------------------------------------------------

  /** A mark: one tap, and it is logged. */
  function markChip(activity) {
    return el('button.mark', {
      type: 'button',
      title: activity.help ?? activity.name,
      dataset: { log: activity.id, kind: 'mark', rest: String(activity.id === 'rest_day') },
      onclick: () => record(activity.id, null),
    }, [icon(activity.id === 'rest_day' ? 'rest' : 'check'), activity.name])
  }

  /**
   * A measurement: the field is already there, so logging is the number and one
   * tap. Nothing to open first.
   */
  function entryTile(activity) {
    const input = el('input.entry__value', {
      type: 'text', inputmode: 'decimal',
      'aria-label': `${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,
      dataset: { entry: activity.id },
      onkeydown: (event) => { if (event.key === 'Enter') { event.preventDefault(); record(activity.id, input.value) } },
    })

    return el('div.entry', { dataset: { activity: activity.id } }, [
      el('span.entry__label', {}, [
        activity.short ?? activity.name,
        // The unit is a footnote beside the name, at half the size and dimmed —
        // it is not worth a line of its own on a screen this dense.
        el('span.entry__unit', { text: unitLabel(activity) }),
      ]),
      el('div.entry__row', {}, [
        input,
        el('button.entry__confirm', {
          type: 'button', 'aria-label': `Log ${activity.name}`,
          dataset: { log: activity.id, kind: 'number' },
          onclick: () => record(activity.id, input.value),
        }, [icon('check')]),
      ]),
    ])
  }

  function workedRow(activity) {
    return el('div.worked__row', { dataset: { worked: activity.id } }, [
      el('span.worked__name', { text: activity.name }),
      el('span.worked__value', { text: valueLabel(activity, activity.value) }),
    ])
  }

  async function record(activityId, value) {
    const result = await daily.log(activityId, value)
    const earned = Object.values(result.xpByAttribute ?? {}).reduce((sum, n) => sum + n, 0)
    justEarned = {
      id: activityId,
      xp: earned,
      levelled: result.levelledUp?.[0]
        ? `${result.levelledUp[0].attribute} reached ${result.levelledUp[0].tier}`
        : null,
    }
    await reload()
  }

  // --- screen ---------------------------------------------------------------

  function render() {
    const tasks = today?.tasks ?? []
    const outstandingSlots = tasks.filter((task) => !task.done)
    const workedSlots = tasks.filter((task) => task.done)
    const marks = (day?.outstanding ?? []).filter((activity) => activity.spec.entry === 'mark')
    const entries = (day?.outstanding ?? []).filter((activity) => activity.spec.entry === 'number')
    const done = day?.logged ?? []
    const workedCount = workedSlots.length + done.length

    replace(root, [
      el('h1.screen__title', { text: 'Today' }),

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
        : el('p.today__frame', {
            text: today
              ? outstandingSlots.length === 0
                ? `${today.day.name} is worked through. Everything else here is still open.`
                : `${today.day.name}. ${workedSlots.length} of ${tasks.length} slots worked.`
              : 'No program is active. Start one from Train.',
          }),

      // No "OUTSTANDING" heading: everything above the worked toggle is
      // outstanding by construction, and on a 6.1" screen a 28px heading is
      // two activity tiles' worth of room spent saying what the screen already
      // says. Sectioning that costs you the thing it labels is not sectioning.
      el('section.block', {}, [
        outstandingSlots.length > 0 && el('div.tasks', {},
          outstandingSlots.map((task) => slotRow(task, today.day))),

        marks.length > 0 && el('div.marks', {}, marks.map(markChip)),
        entries.length > 0 && el('div.entries', {}, entries.map(entryTile)),

        outstandingSlots.length === 0 && marks.length === 0 && entries.length === 0
          && el('p.block__hint', { text: 'Nothing outstanding. The day is yours.' }),
      ]),

      workedCount > 0 && el('section.block', {}, [
        el('button.worked__toggle', {
          type: 'button', dataset: { worked: 'toggle', open: String(workedOpen) },
          onclick: () => { workedOpen = !workedOpen; render() },
        }, [icon('check'), `${workedCount} WORKED TODAY`]),

        // A finished slot stays a task, not a receipt: `docs/10` makes the slot
        // the unit, and a slot you have already worked is still one you can
        // open and add a set to. Only the daily activities become plain rows.
        workedOpen && el('div.worked', {}, [
          ...workedSlots.map((task) => slotRow(task, today.day)),
          ...done.map(workedRow),
        ]),
      ]),
    ])
  }

  async function reload() {
    today = await workout.todayTasks()
    day = await daily.today()
    render()
  }

  /** Arriving at the screen clears the last entry's acknowledgement. */
  async function refresh() {
    justEarned = null
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
