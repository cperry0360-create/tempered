/**
 * TRAIN — routines, the exercise library, and the two ways into a session.
 *
 * The ad-hoc path is deliberately as short as the routine path: from here, one
 * tap on an exercise starts logging it. `docs/05` calls that a first-class
 * feature, not a shortcut — some days are one exercise.
 */

import { el, replace } from '../dom.js'
import { lbs, since } from '../format.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(options: object) => void} deps.onStart
 */
export function createTrainScreen({ workout, storage, clock, onStart }) {
  const root = el('div.screen.screen--train')
  let query = ''
  /** @type {{program: any, week: number, deload: boolean}|null} */ let active = null
  /** @type {any} */ let guide = null
  let guideOpen = false
  /** @type {any[]} */ let routines = []
  /** @type {any[]} */ let exercises = []
  /** @type {Map<string, any>} */ let records = new Map()
  /** @type {Map<string, string>} */ const lastByExercise = new Map()

  function routineCard(routine) {
    const setCount = (routine.exercises ?? []).reduce((sum, e) => sum + (e.sets ?? 0), 0)
    const primary = (routine.exercises ?? [])[0]
    const primaryExercise = exercises.find((e) => e.id === primary?.id)
    return el('section.card.routine', { dataset: { routine: routine.id } }, [
      el('h2.routine__name', { text: routine.name }),
      el('p.routine__meta', {
        text: `${(routine.exercises ?? []).length} exercises · ${setCount} sets`,
      }),
      primaryExercise && el('p.routine__primary', {
        text: `${primaryExercise.name}${primary.weight ? ` · ${lbs(primary.weight)} lbs` : ''}`,
      }),
      el('button.button.button--primary.button--wide', {
        type: 'button', dataset: { start: routine.id },
        onclick: () => onStart({ routine }),
      }, ['START']),
    ])
  }

  function exerciseRow(exercise) {
    const best = records.get(exercise.id)?.bestWeight
    const last = lastByExercise.get(exercise.id)
    return el('button.libraryrow', {
      type: 'button', dataset: { exercise: exercise.id },
      onclick: () => onStart({ routine: null, exerciseId: exercise.id }),
    }, [
      el('span.libraryrow__main', {}, [
        el('span.libraryrow__name', { text: exercise.name }),
        el('span.libraryrow__meta', {
          text: [exercise.group, exercise.class].filter(Boolean).join(' · '),
        }),
      ]),
      el('span.libraryrow__stats', {}, [
        best && el('span.libraryrow__pr', { text: `PR ${lbs(best.weight)} × ${best.reps}` }),
        el('span.libraryrow__last', { text: last ? since(last, clock.today()) : 'not yet worked' }),
      ]),
    ])
  }

  /** The active program: its days, the week it is on, and the derived guide. */
  function programBlock() {
    if (!active) return null
    const { program, week, deload } = active
    return el('section.block', { dataset: { program: program.id } }, [
      el('h2.block__title', { text: 'Active program' }),
      el('section.card.program', {}, [
        el('div.program__head', {}, [
          el('h3.program__name', { text: program.name }),
          el('span.program__week', { text: `Week ${week} / ${program.weeks}` }),
        ]),
        el('p.program__note', { text: program.note }),
        deload && el('p.deload', { text: 'Deload week. Hold the weight — recovery is half the process.' }),

        ...program.days.map((day) => el('button.programday', {
          type: 'button', dataset: { programday: day.id },
          onclick: () => onStart({ programDay: day }),
        }, [
          el('span.programday__main', {}, [
            el('span.programday__name', { text: day.name }),
            el('span.programday__focus', { text: day.focus }),
          ]),
          el('span.programday__count', { text: `${day.exercises.length}` }),
        ])),

        el('button.tool', {
          type: 'button', dataset: { guide: 'toggle' },
          onclick: () => { guideOpen = !guideOpen; render() },
        }, [guideOpen ? 'HIDE GUIDE' : 'GUIDE']),

        guideOpen && guide && el('div.panel', {}, [
          el('p.panel__note', { text: 'Weekly hard sets per muscle group, counted from the program itself.' }),
          el('div.guide', {}, guide.hardSets.map((row) => el('div.guide__row', {}, [
            el('span.guide__group', { text: row.group.replace(/_/g, ' ') }),
            el('span.guide__bar', { style: `--fill:${Math.round((row.sets / guide.hardSets[0].sets) * 100)}%` }),
            el('span.guide__sets', { text: `${row.sets}` }),
          ]))),
        ]),
      ]),
    ])
  }

  function render() {
    const filtered = query
      ? exercises.filter((e) => `${e.name} ${e.group ?? ''} ${e.pattern ?? ''}`.toLowerCase().includes(query))
      : exercises

    replace(root, [
      el('h1.screen__title', { text: 'Train' }),

      programBlock(),

      el('section.block', {}, [
        el('h2.block__title', { text: 'Routines' }),
        ...routines.map(routineCard),
      ]),

      el('section.block', {}, [
        el('h2.block__title', { text: 'Exercise library' }),
        el('p.block__hint', { text: 'Tap any exercise to work it on its own.' }),
        el('input.search', {
          type: 'search', placeholder: 'Search exercises', value: query,
          'aria-label': 'Search exercises', dataset: { search: 'library' },
          oninput: (event) => { query = event.target.value.trim().toLowerCase(); render() },
        }),
        el('div.library', {}, filtered.map(exerciseRow)),
        filtered.length === 0 && el('p.block__hint', { text: 'Nothing matches that yet.' }),
      ]),
    ])
  }

  return {
    root,
    async refresh() {
      active = await workout.activeProgram()
      guide = await workout.programGuide()
      routines = await storage.getAll('routines')
      exercises = (await storage.getAll('exercises')).sort((a, b) => a.name.localeCompare(b.name))
      records = await workout.recordMap()

      lastByExercise.clear()
      const sessions = new Map((await storage.getAll('sessions')).map((s) => [s.id, s]))
      for (const log of await storage.getAll('setLogs')) {
        const date = sessions.get(log.sessionId)?.date
        if (!date) continue
        if (!lastByExercise.has(log.exerciseId) || date > lastByExercise.get(log.exerciseId)) {
          lastByExercise.set(log.exerciseId, date)
        }
      }
      render()
    },
  }
}
