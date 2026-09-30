/**
 * SETUP — a short, guided first-use flow.
 *
 * The last step is the actual tracker contract: each lifestyle item is OFF,
 * DAILY, or WEEKLY with a target count. Training frequency comes from the
 * selected program and Today aggregates repeated exercises across that week.
 */

import { createProgramRevision } from '../../domain/program-schema.js'
import { el, replace } from '../dom.js'

const STEP_COUNT = 7
const SESSION_OPTIONS = [2, 3, 4, 5, 6]
const SESSION_LENGTH_OPTIONS = [30, 45, 60, 75]
const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]
const GOALS = [
  ['strength', 'General strength'],
  ['muscle', 'Build muscle'],
  ['run-support', 'Run-support strength'],
  ['custom', 'Something custom'],
]
const EQUIPMENT = [
  ['full-gym', 'Full gym'],
  ['home-gym', 'Home gym'],
  ['dumbbells', 'Dumbbells only'],
  ['bodyweight', 'Bodyweight'],
]
const TEMPLATE_OPTIONS = [
  ['foundation', 'Strength Foundation', 'Three repeatable days · full-body basics · easy to scale'],
  ['physique', 'November Physique', 'Upper-body biased · 8 weeks · deload included'],
  ['mercy', 'Mercy Mode', 'A gentler leg day for “I am scared of leg day” weeks'],
]
const clone = (value) => JSON.parse(JSON.stringify(value))

function defaultSchedule(activities, profile) {
  const legacy = new Set(profile?.dailyActivityIds ?? activities.filter((a) => a.daily === true).map((a) => a.id))
  const stored = profile?.activitySchedule ?? {}
  return Object.fromEntries(activities.map((activity) => {
    const raw = stored[activity.id]
    if (raw?.cadence === 'daily') return [activity.id, { cadence: 'daily', target: 1 }]
    if (raw?.cadence === 'weekly') return [activity.id, {
      cadence: 'weekly', target: Math.max(1, Math.min(7, Number(raw.target) || 1)),
    }]
    if (raw?.cadence === 'off') return [activity.id, { cadence: 'off', target: 1 }]
    return [activity.id, legacy.has(activity.id)
      ? { cadence: 'daily', target: 1 }
      : { cadence: 'off', target: 1 }]
  }))
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

function exerciseFrequency(program) {
  const counts = new Map()
  for (const day of program?.days ?? []) {
    for (const slot of day.exercises ?? []) {
      counts.set(slot.exerciseId, {
        name: slot.name,
        count: (counts.get(slot.exerciseId)?.count ?? 0) + 1,
      })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function storedWeight(program, exerciseId) {
  for (const day of program?.days ?? []) {
    for (const slot of day.exercises ?? []) {
      if (slot.exerciseId === exerciseId && typeof slot.weight === 'number') return slot.weight
    }
  }
  return ''
}

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

  function templateProgram() {
    const source = activeProgram()
    if (!source || draft.startPath === 'blank') return null
    if (draft.templateId === 'physique') return source
    const next = clone(source)
    next.id = `tempered-${draft.templateId}`
    next.templateId = draft.templateId
    next.source = 'user'
    next.status = 'draft'
    if (draft.templateId === 'foundation') {
      next.name = 'Strength Foundation'
      next.note = 'Three repeatable full-body days. Build consistency before complexity.'
      next.days = (next.days ?? []).slice(0, 3).map((day, index) => ({
        ...day, id: `foundation-${index + 1}`,
        name: ['Full Body A', 'Full Body B', 'Full Body C'][index],
        exercises: (day.exercises ?? []).slice(0, 4),
      }))
    }
    if (draft.templateId === 'mercy') {
      next.name = 'Mercy Mode'
      next.note = 'Keep the habit. Keep the leg day humane.'
      next.days = (next.days ?? []).map((day) => /leg/i.test(day.name)
        ? { ...day, name: 'Mercy Legs + Core', exercises: (day.exercises ?? []).slice(0, 3) }
        : day)
    }
    return next
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
      type: 'text', value: draft.name, placeholder: 'Your name', autocomplete: 'name',
      'aria-label': 'Name', oninput: (event) => { draft.name = event.target.value },
    })
    const unitButton = (value, label) => el('button.setup__choice', {
      type: 'button', dataset: { selected: String(draft.units === value) },
      onclick: () => { draft.units = value; render() },
    }, [label])
    return [
      ...heading('Step 1 of 7', 'Build strength, keep your life', 'Tempered brings training, nutrition, sleep, and recovery into one clear plan.'),
      el('section.setup__card', {}, [
        el('p.setup__copy', { text: 'Follow the plan, record what happened, and let recovery count too.' }),
        el('p.setup__copy', { text: 'Your data stays local and these choices can change later.' }),
        el('label.setup__label', { text: 'Name (optional)' }), name,
        el('span.setup__label', { text: 'Units' }),
        el('div.setup__choices', {}, [unitButton('imperial', 'lb / mi'), unitButton('metric', 'kg / km')]),
      ]),
    ]
  }

  function stepTwo() {
    return [
      ...heading('Step 2 of 7', 'Choose your rhythm', 'Pick the goal and schedule you can actually repeat. A useful plan beats a heroic plan you abandon.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Primary goal' }),
        el('div.setup__choices', {}, GOALS.map(([value, label]) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.goal === value) },
          onclick: () => { draft.goal = value; render() },
        }, [label]))),
        el('span.setup__label', { text: 'Training sessions per week' }),
        el('div.setup__numberchoices', {}, SESSION_OPTIONS.map((value) => el('button.setup__number', {
          type: 'button', dataset: { selected: String(draft.sessionsPerWeek === value) },
          onclick: () => { draft.sessionsPerWeek = value; render() },
        }, [String(value)]))),
        el('span.setup__label', { text: 'Typical session length' }),
        el('div.setup__choices', {}, SESSION_LENGTH_OPTIONS.map((value) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.sessionLength === value) },
          onclick: () => { draft.sessionLength = value; render() },
        }, [`${value} min`]))),
      ]),
    ]
  }

  function stepThree() {
    return [
      ...heading('Step 3 of 7', 'Use what you have', 'This helps Tempered suggest a plan that fits your real setup. You can still substitute movements later.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Available equipment' }),
        el('div.setup__choices', {}, EQUIPMENT.map(([value, label]) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.equipment === value) },
          onclick: () => { draft.equipment = value; render() },
        }, [label]))),
      ]),
    ]
  }

  function stepFour() {
    return [
      ...heading('Step 4 of 7', 'Choose how to begin', 'Pick a starting template, or open a blank draft and shape it yourself. Nothing activates until you save.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Starting path' }),
        el('div.setup__choices', {}, [
          el('button.setup__choice', { type: 'button', dataset: { selected: String(draft.startPath === 'template') }, onclick: () => { draft.startPath = 'template'; render() } }, ['Use a template']),
          el('button.setup__choice', { type: 'button', dataset: { selected: String(draft.startPath === 'blank') }, onclick: () => { draft.startPath = 'blank'; render() } }, ['Start blank']),
        ]),
      ]),
      draft.startPath === 'blank'
        ? el('section.setup__card', {}, [el('p.setup__copy', { text: 'Your blank draft stays editable from Train.' })])
        : el('div.setup__stack', {}, TEMPLATE_OPTIONS.map(([value, label, copy]) => el('button.setup__program', {
            type: 'button', dataset: { selected: String(draft.templateId === value) },
            onclick: () => { draft.templateId = value; render() },
          }, [el('span.setup__programname', { text: label }), el('span.setup__programmeta', { text: copy })]))),
    ]
  }

  function stepFive() {
    const slots = primarySlots(activeProgram())
    return [
      ...heading('Step 5 of 7', 'Review your start', 'This is a starting point, not a test. Add weights if you know them; blank means figure it out in the first session.'),
      el('section.setup__card.setup__weights', {}, slots.length
        ? slots.map((slot) => el('label.setup__weightrow', {}, [
            el('span.setup__weightname', { text: slot.name }),
            el('span.setup__weightfield', {}, [
              el('input.setup__weightinput', {
                type: 'number', inputmode: 'decimal', min: '0', step: draft.units === 'metric' ? '1' : '5',
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

  function cadenceButton(activity, cadence, label) {
    const current = draft.schedule[activity.id]
    return el('button.setup__cadence', {
      type: 'button',
      dataset: { selected: String(current.cadence === cadence) },
      onclick: () => {
        current.cadence = cadence
        if (cadence !== 'weekly') current.target = 1
        render()
      },
    }, [label])
  }

  function stepSix() {
    return [
      ...heading('Step 6 of 7', 'What do you want to track?', 'Daily resets each morning. Weekly can be done on any day. Nothing here creates a penalty.'),
      el('div.setup__cadencelist', {}, activities.map((activity) => {
        const current = draft.schedule[activity.id]
        return el('section.setup__cadencerow', { dataset: { attribute: activity.attribute } }, [
          el('div.setup__cadencehead', {}, [
            el('span.setup__activityname', { text: activity.name }),
            current.cadence === 'weekly' && el('select.setup__weeklyselect', {
              value: String(current.target),
              'aria-label': `${activity.name} times per week`,
              onchange: (event) => { current.target = Number(event.target.value); render() },
            }, WEEKLY_OPTIONS.map((value) => el('option', { value: String(value) }, [`${value}×/wk`]))),
          ]),
          el('div.setup__cadencechoices', {}, [
            cadenceButton(activity, 'off', 'Off'),
            cadenceButton(activity, 'daily', 'Daily'),
            cadenceButton(activity, 'weekly', current.cadence === 'weekly' ? `${current.target}× / WK` : 'Weekly'),
          ]),
        ])
      })),
    ]
  }

  function stepEight() {
    const chosen = activeProgram()
    const action = draft.startPath === 'blank'
      ? 'Open Train when you are ready to shape your blank program.'
      : chosen ? `Start with ${chosen.name} and run ${draft.sessionsPerWeek} realistic sessions this week.` : 'Explore Today and add your first workout when you are ready.'
    return [
      ...heading('Step 7 of 7', 'You have a next step', 'Tempered works best when the next action is obvious and the plan is forgiving.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Your starting point' }),
        el('p.setup__copy', { text: action }),
        el('p.setup__copy', { text: 'You can edit these preferences later without resetting history.' }),
      ]),
    ]
  }

  const builders = [stepOne, stepTwo, stepThree, stepFour, stepFive, stepSix, stepEight]

  function next() {
    if (step < STEP_COUNT - 1) { step += 1; render() }
    else finish()
  }
  function back() { if (step > 0) { step -= 1; render() } }

  async function finish() {
    const dailyActivityIds = activities.map((a) => a.id)
      .filter((id) => draft.schedule[id]?.cadence === 'daily')
    await storage.put('profile', {
      ...profile,
      name: String(draft.name ?? '').trim(),
      units: draft.units,
      planTargetSessionsPerWeek: draft.sessionsPerWeek,
      goal: draft.goal,
      sessionLength: draft.sessionLength,
      equipment: draft.equipment,
      setupPath: draft.startPath,
      templateId: draft.templateId,
      activitySchedule: clone(draft.schedule),
      dailyActivityIds,
      setupComplete: true,
    })

    const chosen = draft.startPath === 'blank' ? null : templateProgram()
    if (draft.startPath === 'blank') {
      const existingBlank = programs.find((program) => program.templateId === 'blank')
      if (!existingBlank) {
        const blankId = `custom-${clock.today()}-${programs.length + 1}`
        await storage.put('programs', {
          id: blankId, programSchemaVersion: 2, source: 'user', status: 'draft',
          templateId: 'blank', name: 'My blank program', weeks: 1, days: [],
          revisionNumber: 1, currentRevisionId: `${blankId}:r1`,
        })
      }
    }
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
      const revision = await storage.get('programRevisions', updated.currentRevisionId)
      if (revision && revision.programId === updated.id) {
        await storage.put('programRevisions', createProgramRevision(updated, {
          id: revision.id, version: revision.version, createdAt: revision.createdAt,
        }))
      } else {
        updated.currentRevisionId = `${updated.id}:r1`
        updated.revisionNumber = 1
        await storage.put('programs', updated)
        await storage.put('programRevisions', createProgramRevision(updated, {
          id: updated.currentRevisionId, version: 1, createdAt: clock.nowIso(),
        }))
      }

      const byId = new Map(states.map((state) => [state.programId, state]))
      for (const program of [...programs, chosen]) {
        const prior = byId.get(program.id)
        const revisionId = prior?.revisionId ?? (program.id === updated.id ? updated.currentRevisionId : program.currentRevisionId)
        await storage.put('programState', {
          ...prior,
          programId: program.id,
          startedOn: prior?.startedOn ?? clock.today(),
          active: program.id === chosen.id,
          ...(revisionId ? { revisionId } : {}),
        })
      }
    }
    await onDone()
  }

  function footer() {
    const left = step > 0
      ? el('button.setup__quiet', { type: 'button', onclick: back }, ['Back'])
      : rerun && onCancel
        ? el('button.setup__quiet', { type: 'button', onclick: () => onCancel() }, ['Cancel'])
        : el('span')
    return el('div.setup__footer', {}, [
      left,
      step < STEP_COUNT - 1 && el('button.setup__quiet', { type: 'button', onclick: next }, ['Skip']),
      el('button.setup__next', { type: 'button', dataset: { acid: 'primary' }, onclick: next }, [
        step === STEP_COUNT - 1 ? (rerun ? 'Save' : 'Start tempering') : 'Next',
      ]),
    ])
  }

  function render() {
    replace(root, [el('div.setup__inner', {}, [progress(), ...builders[step](), footer()])])
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
      goal: profile?.goal ?? 'strength',
      sessionsPerWeek: profile?.planTargetSessionsPerWeek ?? 4,
      sessionLength: profile?.sessionLength ?? 45,
      equipment: profile?.equipment ?? 'full-gym',
      startPath: profile?.setupPath === 'blank' ? 'blank' : 'template',
      templateId: profile?.templateId ?? 'physique',
      programId,
      weights,
      schedule: defaultSchedule(activities, profile),
    }
    step = 0
    replace(mount, [root])
    render()
  }

  return { root, start }
}
