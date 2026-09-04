/**
 * TODAY — what is outstanding right now.
 *
 * `docs/10-task-model.md`: the unit is the exercise slot. Today lists the day's
 * prescribed slots as tasks, each independently completable without starting a
 * session. Unfinished slots roll forward through the program week.
 *
 * There is no overdue state anywhere in here, and there must never be one.
 * Outstanding is outstanding: nothing is late, nothing is missed, nothing turns
 * red. An unfinished slot is neutral until the week ends, and then it is simply
 * gone. Absence is not failure.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(options: object) => void} deps.onStart
 * @param {(slot: object) => void} deps.onOpenSlot
 */
export function createTodayScreen({ workout, clock, onStart, onOpenSlot }) {
  const root = el('div.screen.screen--today')
  /** @type {any} */ let today = null

  function taskRow(task, day) {
    const done = task.done
    return el('button.task', {
      type: 'button',
      dataset: { task: task.key, done: String(done), started: String(task.started) },
      onclick: () => onOpenSlot({
        dayId: day.id,
        slotIndex: task.index,
        exerciseId: task.slot.exerciseId,
        slot: task.slot,
        alreadyLogged: task.logged,
      }),
    }, [
      el('span.task__mark', {}, [done && icon('check')]),
      el('span.task__main', {}, [
        el('span.task__name', { text: task.slot.name }),
        el('span.task__pres', {
          text: `${task.slot.sets} × ${task.slot.repMin}–${task.slot.repMax}`
            + (task.slot.perSide ? ' / side' : ''),
        }),
      ]),
      el('span.task__count', {
        // "2 of 4" while in progress. Never "2 short", never a countdown.
        text: done ? 'done' : task.started ? `${task.logged} of ${task.slot.sets}` : '',
      }),
    ])
  }

  function render() {
    if (!today) {
      replace(root, [
        el('h1.screen__title', { text: 'Today' }),
        el('p.block__hint', { text: 'No program is active. Start one from Train.' }),
      ])
      return
    }

    const outstanding = today.tasks.filter((task) => !task.done)
    const finished = today.tasks.filter((task) => task.done)

    replace(root, [
      el('h1.screen__title', { text: 'Today' }),
      el('p.today__frame', {
        text: outstanding.length === 0
          ? `${today.day.name} is complete. Every slot worked — that is the whole day on the bar.`
          : `${today.day.name}. ${finished.length} of ${today.tasks.length} worked so far. `
            + 'Each one is load on the bar, whenever you get to it.',
      }),

      el('section.block', {}, [
        el('h2.block__title', { text: 'Outstanding' }),
        outstanding.length === 0
          ? el('p.block__hint', { text: 'Nothing outstanding today.' })
          : el('div.tasks', {}, outstanding.map((task) => taskRow(task, today.day))),
        el('p.block__hint', {
          text: 'Anything left is still available for the rest of the week.',
        }),
      ]),

      finished.length > 0 && el('section.block', {}, [
        el('h2.block__title', { text: 'Worked' }),
        el('div.tasks', {}, finished.map((task) => taskRow(task, today.day))),
      ]),
    ])
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

    async refresh() {
      today = await workout.todayTasks()
      render()
    },
  }
}
