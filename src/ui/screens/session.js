/**
 * The active workout — the centre of the app.
 *
 * Everything here serves one number: the speed targets in
 * `docs/05-workout-system.md`. A full lower-body session must be loggable in
 * under 90 seconds of tapping, which means the common case — repeating last
 * session — has to be exactly one tap per set.
 *
 * That is why weight and reps arrive prefilled from last performance, why the
 * check both logs the set and starts the rest timer, and why the rest timer
 * never blocks the next set.
 */

import { el, replace } from '../dom.js'
import { lbs, performance, clock, since } from '../format.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(summary: object) => void} deps.onFinish
 */
export function createSessionScreen({ workout, clock: timeSource, onFinish }) {
  const root = el('div.screen.screen--session')

  /** @type {any} */ let session = null
  /** @type {any[]} */ let plan = []
  /** @type {Map<string, number>} */ const restDefaults = new Map()
  /** @type {{exerciseId: string, endsAt: number, node: HTMLElement}|null} */ let rest = null
  /** @type {number|undefined} */ let ticker

  /** Rest counts down inline and is purely informational — it gates nothing. */
  function startRest(entry, row) {
    const seconds = restDefaults.get(entry.exercise.id) ?? 150
    rest = { exerciseId: entry.exercise.id, endsAt: timeSource.now() + seconds * 1000, node: row }
    tick()
  }

  function tick() {
    if (!rest) return
    const remaining = Math.max(0, (rest.endsAt - timeSource.now()) / 1000)
    const target = root.querySelector(`[data-rest="${rest.exerciseId}"]`)
    if (target) {
      target.textContent = remaining > 0 ? `rest ${clock(remaining)}` : 'rested'
      target.dataset.active = String(remaining > 0)
    }
    if (remaining <= 0) rest = null
  }

  ticker = setInterval(tick, 500)

  /**
   * Which two numbers a set actually has. A loaded carry has no reps and a plank
   * has no load; rendering an empty box for a number that does not exist invites
   * the user to fill in nothing, and costs a tap to skip past.
   *
   * @param {object} exercise
   * @returns {({key: string, label: string, mode: string}|null)[]}
   */
  function fieldsFor(exercise) {
    if (exercise?.metric === 'distance') {
      return [
        { key: 'weight', label: 'LBS', mode: 'decimal' },
        { key: 'distance', label: 'FEET', mode: 'numeric' },
      ]
    }
    if (exercise?.unit === 'time') {
      return [{ key: 'timeSec', label: 'SECS', mode: 'numeric' }, null]
    }
    return [
      { key: 'weight', label: 'LBS', mode: 'decimal' },
      { key: 'reps', label: 'REPS', mode: 'numeric' },
    ]
  }

  /**
   * One set row. The check is the whole interaction in the common case.
   * @param {object} entry
   * @param {object} set
   * @param {number} index
   */
  function setRow(entry, set, index) {
    const done = set.logged === true

    const inputs = fieldsFor(entry.exercise).map((field) => {
      if (!field) return el('span.setrow__num')
      return el('input.setrow__num', {
        type: 'text', inputmode: field.mode, value: set[field.key] ?? '',
        disabled: done, 'aria-label': `${field.label}, set ${index + 1}`,
        dataset: { field: field.key, exercise: entry.exercise.id, set: String(index) },
        onchange: (event) => { set[field.key] = numberOrNull(event.target.value) },
      })
    })

    const check = el('button.setrow__check', {
      type: 'button', disabled: done,
      'aria-label': done ? `Set ${index + 1} logged` : `Log set ${index + 1}`,
      dataset: { log: `${entry.exercise.id}:${index}` },
      onclick: async () => {
        for (const input of inputs) {
          if (input.dataset?.field) set[input.dataset.field] = numberOrNull(input.value)
        }
        await workout.logSet(session, {
          exerciseId: entry.exercise.id,
          weight: set.weight, reps: set.reps,
          timeSec: set.timeSec ?? null, distance: set.distance ?? null,
          setIndex: index,
        })
        set.logged = true
        render()
        startRest(entry, check)
      },
    }, ['✓'])

    return el('div.setrow', { dataset: { done: String(done) } }, [
      el('span.setrow__index', { text: String(index + 1) }),
      el('span.setrow__record', { text: performance(entry.last?.sets?.[index] ?? entry.last?.sets?.[0] ?? null) }),
      ...inputs,
      check,
    ])
  }

  /** @param {string} value */
  function numberOrNull(value) {
    const parsed = Number.parseFloat(String(value).trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  function exerciseCard(entry) {
    const best = entry.record?.bestWeight
    return el('section.card.exercise', { dataset: { exercise: entry.exercise.id } }, [
      el('header.exercise__head', {}, [
        el('div', {}, [
          el('h2.exercise__name', { text: entry.exercise.name }),
          el('p.exercise__meta', {
            text: `${entry.exercise.variant ?? ''}${entry.exercise.variant ? ' · ' : ''}${entry.exercise.pattern ?? ''}`,
          }),
        ]),
        el('span.exercise__rest', { dataset: { rest: entry.exercise.id }, text: '' }),
      ]),

      // Last performance and PR, before a single set is entered.
      el('div.exercise__history', {}, [
        el('span.pill', { dataset: { kind: 'last' } }, [
          el('span.pill__label', { text: 'LAST' }),
          el('span.pill__value', { text: entry.last ? performance(entry.last.sets[0]) : 'first time' }),
          entry.last && el('span.pill__aside', { text: since(entry.last.date, timeSource.today()) }),
        ]),
        el('span.pill', { dataset: { kind: 'pr' } }, [
          el('span.pill__label', { text: 'PR' }),
          el('span.pill__value', { text: best ? `${lbs(best.weight)} × ${best.reps}` : '—' }),
        ]),
      ]),

      entry.proposal?.reason && el('p.exercise__proposal', { text: entry.proposal.reason }),

      el('div.setrow.setrow--head', {}, [
        el('span.setrow__index', { text: 'SET' }),
        el('span.setrow__record', { text: 'LAST' }),
        ...fieldsFor(entry.exercise).map((field) => el('span.setrow__num', { text: field?.label ?? '' })),
        el('span', { text: '' }),
      ]),

      ...entry.sets.map((set, index) => setRow(entry, set, index)),

      el('button.addset', {
        type: 'button', dataset: { addset: entry.exercise.id },
        onclick: () => {
          const previous = entry.sets.at(-1)
          entry.sets.push({ weight: previous?.weight ?? null, reps: previous?.reps ?? null, logged: false })
          render()
        },
      }, ['+ ADD SET']),
    ])
  }

  function render() {
    replace(root, [
      el('header.sessionbar', {}, [
        el('div', {}, [
          el('h1.sessionbar__title', { text: session?.routineName ?? 'Session' }),
          el('p.sessionbar__meta', { text: `${loggedCount()} sets logged` }),
        ]),
        el('button.button.button--quiet', {
          type: 'button', dataset: { action: 'finish-top' }, onclick: finish,
        }, ['FINISH']),
      ]),
      ...plan.map(exerciseCard),
      el('button.button.button--primary.button--wide', {
        type: 'button', dataset: { action: 'finish' }, onclick: finish,
      }, ['FINISH SESSION']),
    ])
    tick()
  }

  function loggedCount() {
    return plan.reduce((total, entry) => total + entry.sets.filter((s) => s.logged).length, 0)
  }

  async function finish() {
    const summary = await workout.finishSession(session)
    onFinish(summary)
  }

  return {
    root,

    /**
     * @param {object} options
     * @param {object|null} options.routine
     * @param {string|null} [options.exerciseId] For an ad-hoc single exercise.
     */
    async start({ routine, exerciseId = null }) {
      session = await workout.startSession(routine?.id ?? null)
      session.routineName = routine?.name ?? 'Single exercise'

      const wanted = routine
        ? routine.exercises
        : [{ id: exerciseId, sets: 3, reps: null, weight: null }]

      plan = []
      for (const entry of wanted) {
        const prepared = await workout.prepareExercise(entry.id, {
          sets: entry.sets, reps: entry.reps, weight: entry.weight, distance: entry.distance,
        })
        if (!prepared.exercise) continue
        restDefaults.set(entry.id, entry.rest ?? 150)
        plan.push({
          ...prepared,
          sets: prepared.proposal.sets.map((set) => ({ ...set, logged: false })),
        })
      }
      render()
    },

    destroy() { clearInterval(ticker); ticker = undefined },
  }
}
