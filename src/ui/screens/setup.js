/**
 * SETUP — five fast, skippable steps.
 *
 * First run lands here. Settings can re-run it later without touching history.
 * The draft stays in memory until FINISH, so backing out of a re-run is safe.
 */

import { el, replace } from '../dom.js'

const STEP_COUNT = 5
const SESSION_OPTIONS = [2, 3, 4, 5, 6]

const clone = (value) => JSON.parse(JSON.stringify(value))

function defaultDailyIds(activities) {
  return activities.filter((activity) => activity.daily === true).map((activity) => activity.id)
}

function primarySlots(program) {
  const seen = new Set()
  const slots = []
  for (const day of program?.days ?? []) {
    const slot = day.exercises?.[0]
    if (!slot || seen.has(slot.exerciseId)) continue
    seen.add(slot.exerciseId)
    slots.push(slot)
  }
  return slots
}

function storedWeight(program, exerciseId) {
  for (const day of program?.days ?? []) {
    for (const slot of day.exercises ?? []) {
      if (slot.exerciseId === exerciseId && typeof slot.weight === 'number') return slot.weight
    }
  }
  return ''
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.mount
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {any[]} deps.activities
 * @param {() => Promise<void>|void} deps.onDone
 * @param {(() => Promise<void>|void)|null} [deps.onCancel]
 */
export function createSetupScreen({ mount, storage, clock, activities, onDone, onCancel = null }) {
  const root = el('main.setup')
  let step = 0
  let rerun = false
  let profile = null
  let programs = []
  let states = []
  let draft = null

  function activeProgram() {
    return programs.find((program) => program.id === draft.programId) ?? programs[0] ?? null
  }

  function progress() {
    return el('div.setup__progress', {}, Array.from({ length: STEP_COUNT }, (_, index) =>
      el('span.setup__dot', { dataset: { active: String(index <= step) } })))
  }

  function heading(kicker, title, copy) {
    return [
      el('p.setup__kicker', { text: kicker }),
      el('h1.setup__title', { text: title }),
      el('p.setup__copy', { text: copy }),
    ]
  }

  function stepOne() {
    const name = el('input.setup__input', {
      type: 'text',
      value: draft.name,
      placeholder: 'Your name',
      autocomplete: 'name',
      'aria-label': 'Name',
      oninput: (event) => { draft.name = event.target.value },
    })

    const unitButton = (value, label) => el('button.setup__choice', {
      type: 'button',
      dataset: { selected: String(draft.units === value) },
      onclick: () => { draft.units = value; render() },
    }, [label])

    return [
      ...heading('STEP 1 OF 5', 'MAKE IT YOURS', 'Name is optional. Pick the units you want everywhere else.'),
      el('section.setup__card', {}, [
        el('label.setup__label', { text: 'Name' }),
        name,
        el('span.setup__label', { text: 'Units' }),
        el('div.setup__choices', {}, [
          unitButton('imperial', 'LB / MI'),
          unitButton('metric', 'KG / KM'),
        ]),
      ]),
    ]
  }

  function stepTwo() {
    return [
      ...heading('STEP 2 OF 5', 'SET THE RHYTHM', 'This is a target, not a streak. It helps the app judge a training week.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Sessions per week' }),
        el('div.setup__numberchoices', {}, SESSION_OPTIONS.map((value) => el('button.setup__number', {
          type: 'button',
          dataset: { selected: String(draft.sessionsPerWeek === value) },
          onclick: () => { draft.sessionsPerWeek = value; render() },
        }, [String(value)]))),
      ]),
    ]
  }

  function stepThree() {
    return [
      ...heading('STEP 3 OF 5', 'PICK THE PLAN', 'Choose the program Today and Train should work from. You can change it later.'),
      el('div.setup__stack', {}, programs.length
        ? programs.map((program) => el('button.setup__program', {
            type: 'button',
            dataset: { selected: String(draft.programId === program.id) },
            onclick: () => {
              draft.programId = program.id
              for (const slot of primarySlots(program)) {
                if (!(slot.exerciseId in draft.weights)) draft.weights[slot.exerciseId] = storedWeight(program, slot.exerciseId)
              }
              render()
            },
          }, [
            el('span.setup__programname', { text: program.name }),
            el('span.setup__programmeta', {
              text: `${program.days?.length ?? 0} training days · ${program.weeks ?? 1} weeks`,
            }),
            program.note && el('span.setup__programnote', { text: program.note }),
          ]))
        : [el('section.setup__card', {}, [el('p.setup__copy', { text: 'No program is installed yet. You can skip this step.' })])]),
    ]
  }

  function stepFour() {
    const program = activeProgram()
    const slots = primarySlots(program)
    return [
      ...heading('STEP 4 OF 5', 'STARTING WEIGHTS', 'Optional. Add the working weight you would use today. Blank means “figure it out in the first session.”'),
      el('section.setup__card.setup__weights', {}, slots.length
        ? slots.map((slot) => el('label.setup__weightrow', {}, [
            el('span.setup__weightname', { text: slot.name }),
            el('span.setup__weightfield', {}, [
              el('input.setup__weightinput', {
                type: 'number',
                inputmode: 'decimal',
                min: '0',
                step: draft.units === 'metric' ? '1' : '5',
                value: draft.weights[slot.exerciseId] ?? '',
                'aria-label': `${slot.name} starting weight`,
                oninput: (event) => { draft.weights[slot.exerciseId] = event.target.value },
              }),
              el('span.setup__unit', { text: draft.units === 'metric' ? 'kg' : 'lb' }),
            ]),
          ]))
        : [el('p.setup__copy', { text: 'No primary lifts to set for this program.' })]),
    ]
  }

  function stepFive() {
    const chosen = draft.dailyIds
    return [
      ...heading('STEP 5 OF 5', 'WHAT MATTERS DAILY?', 'Pick what belongs on Today. Everything else stays one tap away and earns the same XP.'),
      el('div.setup__activitygrid', {}, activities.map((activity) => el('button.setup__activity', {
        type: 'button',
        dataset: { selected: String(chosen.has(activity.id)), attribute: activity.attribute },
        onclick: () => {
          if (chosen.has(activity.id)) chosen.delete(activity.id)
          else chosen.add(activity.id)
          render()
        },
      }, [
        el('span.setup__check', { text: chosen.has(activity.id) ? '✓' : '+' }),
        el('span.setup__activityname', { text: activity.short ?? activity.name }),
      ]))),
    ]
  }

  const builders = [stepOne, stepTwo, stepThree, stepFour, stepFive]

  function next() {
    if (step < STEP_COUNT - 1) {
      step += 1
      render()
    } else finish()
  }

  function back() {
    if (step > 0) {
      step -= 1
      render()
    }
  }

  async function finish() {
    const nextProfile = {
      ...profile,
      name: String(draft.name ?? '').trim(),
      units: draft.units,
      planTargetSessionsPerWeek: draft.sessionsPerWeek,
      dailyActivityIds: [...draft.dailyIds],
      setupComplete: true,
    }
    await storage.put('profile', nextProfile)

    const chosen = programs.find((program) => program.id === draft.programId) ?? null
    if (chosen) {
      const updated = clone(chosen)
      for (const day of updated.days ?? []) {
        for (const slot of day.exercises ?? []) {
          const raw = draft.weights[slot.exerciseId]
          if (raw === '' || raw === null || raw === undefined) continue
          const weight = Number(raw)
          if (Number.isFinite(weight) && weight > 0) slot.weight = weight
        }
      }
      await storage.put('programs', updated)

      const byId = new Map(states.map((state) => [state.programId, state]))
      for (const program of programs) {
        const prior = byId.get(program.id)
        await storage.put('programState', {
          programId: program.id,
          startedOn: prior?.startedOn ?? clock.today(),
          active: program.id === chosen.id,
        })
      }
    }

    await onDone()
  }

  function footer() {
    const left = step > 0
      ? el('button.setup__quiet', { type: 'button', onclick: back }, ['BACK'])
      : rerun && onCancel
        ? el('button.setup__quiet', { type: 'button', onclick: () => onCancel() }, ['CANCEL'])
        : el('span')

    return el('div.setup__footer', {}, [
      left,
      step < STEP_COUNT - 1 && el('button.setup__quiet', { type: 'button', onclick: next }, ['SKIP']),
      el('button.setup__next', {
        type: 'button',
        dataset: { acid: 'primary' },
        onclick: next,
      }, [step === STEP_COUNT - 1 ? (rerun ? 'SAVE' : 'START TEMPERING') : 'NEXT']),
    ])
  }

  function render() {
    replace(root, [
      el('div.setup__inner', {}, [
        progress(),
        ...builders[step](),
        footer(),
      ]),
    ])
    root.scrollTop = 0
  }

  async function start(options = {}) {
    rerun = options.rerun === true
    profile = await storage.get('profile', 'profile')
    programs = await storage.getAll('programs')
    states = await storage.getAll('programState')
    const current = states.find((state) => state.active)
    const programId = current?.programId ?? programs[0]?.id ?? null
    const program = programs.find((entry) => entry.id === programId) ?? programs[0] ?? null

    const weights = {}
    for (const slot of primarySlots(program)) weights[slot.exerciseId] = storedWeight(program, slot.exerciseId)

    draft = {
      name: profile?.name ?? '',
      units: profile?.units ?? 'imperial',
      sessionsPerWeek: profile?.planTargetSessionsPerWeek ?? 4,
      programId,
      weights,
      dailyIds: new Set(profile?.dailyActivityIds ?? defaultDailyIds(activities)),
    }
    step = 0
    replace(mount, [root])
    render()
  }

  return { root, start }
}
