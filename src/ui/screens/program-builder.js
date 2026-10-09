/** Small, reversible mobile program builder. */

import { el, replace } from '../dom.js'
import { customExerciseForm } from '../custom-exercise-form.js'
import { createProgramRevision, migrateProgramRecord, validateProgram } from '../../domain/program-schema.js'

const copy = (value) => JSON.parse(JSON.stringify(value))

export function createProgramBuilderScreen({ mount, storage, clock, workout, onClose }) {
  const root = el('main.program-builder')
  let programs = []
  let exercises = []
  let draft = null
  let selectedDay = 0
  let notice = ''
  let error = ''

  function makeDraft(program) {
    const next = migrateProgramRecord(copy(program ?? {
      id: `custom-${clock.today()}`,
      name: 'My program', weeks: 1, days: [], source: 'user', status: 'draft',
    }), { source: 'user', status: 'draft' })
    next.source = 'user'
    next.status = 'draft'
    if (!Array.isArray(next.days)) next.days = []
    return next
  }

  function selected() { return draft?.days?.[selectedDay] ?? null }

  function exerciseOptions() {
    return exercises.map((exercise) => el('option', { value: exercise.id }, [exercise.name]))
  }

  function render() {
    const day = selected()
    replace(root, [
      el('div.program-builder__inner', {}, [
        el('button.program-builder__back', { type: 'button', onclick: onClose }, ['← Settings']),
        el('p.program-builder__eyebrow', { text: 'Program builder' }),
        el('h1.program-builder__title', { text: 'Make the plan yours.' }),
        el('p.program-builder__copy', { text: 'Build one useful day at a time, save drafts as you go, and activate when ready.' }),
        notice && el('p.notice', { dataset: { builderNotice: '' }, text: notice }),
        error && el('p.notice', { dataset: { builderError: '' }, text: error }),
        el('section.program-builder__card', {}, [
          el('label.program-builder__label', { text: 'Program name' }),
          el('input.program-builder__input', {
            value: draft?.name ?? '', 'aria-label': 'Program name',
            oninput: (event) => { draft.name = event.target.value },
          }),
          el('label.program-builder__label', { text: 'Weeks' }),
          el('input.program-builder__input', {
            type: 'number', min: '1', max: '52', value: draft?.weeks ?? 1, 'aria-label': 'Program weeks',
            oninput: (event) => { draft.weeks = Math.max(1, Number(event.target.value) || 1) },
          }),
        ]),
        el('section.program-builder__card', {}, [
        el('div.program-builder__sectionhead', {}, [el('strong', { text: 'Training days' }), el('button.button', { type: 'button', onclick: () => { draft.days.push({ id: `day-${draft.days.length + 1}`, name: `Day ${draft.days.length + 1}`, focus: '', exercises: [] }); selectedDay = draft.days.length - 1; render() } }, ['Add day'])]),
          draft.days.length
            ? el('div.program-builder__days', {}, draft.days.map((entry, index) => el('button.program-builder__day', {
                type: 'button', dataset: { selected: String(index === selectedDay) }, onclick: () => { selectedDay = index; render() },
              }, [entry.name || `Day ${index + 1}`, el('small', { text: `${entry.exercises?.length ?? 0} exercises` })])))
            : el('p.program-builder__empty', { text: 'Add exercises after creating a training day.' }),
        ]),
        day && el('section.program-builder__card', {}, [
          el('label.program-builder__label', { text: 'Day name' }),
          el('input.program-builder__input', { value: day.name, 'aria-label': 'Training day name', oninput: (event) => { day.name = event.target.value } }),
          el('label.program-builder__label', { text: 'Focus (optional)' }),
          el('input.program-builder__input', { value: day.focus ?? '', 'aria-label': 'Training day focus', oninput: (event) => { day.focus = event.target.value } }),
          el('div.program-builder__exercise-list', {}, (day.exercises ?? []).map((slot, index) => el('article.program-builder__exercise', {}, [
            el('strong', { text: slot.name ?? exercises.find((item) => item.id === slot.exerciseId)?.name ?? slot.exerciseId }),
            el('div.program-builder__fields', {}, [
              el('input.program-builder__small', { type: 'number', min: '1', value: slot.sets ?? 3, 'aria-label': `${slot.name ?? slot.exerciseId} sets`, oninput: (event) => { slot.sets = Math.max(1, Number(event.target.value) || 1) } }),
              el('span', { text: 'sets' }),
              el('input.program-builder__small', { type: 'number', min: '1', value: slot.repMin ?? 8, 'aria-label': `${slot.name ?? slot.exerciseId} minimum reps`, oninput: (event) => { slot.repMin = Math.max(1, Number(event.target.value) || 1) } }),
              el('span', { text: '–' }),
              el('input.program-builder__small', { type: 'number', min: '1', value: slot.repMax ?? 12, 'aria-label': `${slot.name ?? slot.exerciseId} maximum reps`, oninput: (event) => { slot.repMax = Math.max(slot.repMin ?? 1, Number(event.target.value) || (slot.repMin ?? 1)) } }),
              el('span', { text: 'reps' }),
              el('button.program-builder__remove', { type: 'button', onclick: () => { day.exercises.splice(index, 1); render() } }, ['Remove']),
            ]),
          ]))),
          el('div.program-builder__add', {}, [
            el('select.program-builder__select', { 'aria-label': 'Exercise to add' }, [el('option', { value: '' }, ['Choose an exercise']), ...exerciseOptions()]),
            el('button.button', { type: 'button', onclick: () => {
              const select = root.querySelector('.program-builder__select')
              const exercise = exercises.find((item) => item.id === select?.value)
              if (!exercise) return
              day.exercises.push({ exerciseId: exercise.id, name: exercise.name, sets: 3, repMin: 8, repMax: 12, restSec: [90, 120] })
              render()
            } }, ['Add exercise']),
          ]),
          workout && el('details', {}, [el('summary.button', { text: 'Create custom exercise' }), customExerciseForm({ workout, onCancel: () => render(), onSave: async (exercise) => { exercises.push(exercise); day.exercises.push({ exerciseId: exercise.id, name: exercise.name, sets: 3, repMin: 8, repMax: 12, restSec: [90, 120] }); render() } })]),
        ]),
        el('div.program-builder__actions', {}, [
          el('button.button', { type: 'button', onclick: () => save(false) }, ['Save draft']),
          el('button.button.button--primary', { type: 'button', onclick: () => save(true) }, ['Review and activate']),
        ]),
      ]),
    ])
  }

  async function save(activate) {
    error = ''
    const result = validateProgram(draft, { allowIncomplete: !activate })
    if (!result.ok) { error = result.errors[0]; render(); return }
    const existing = programs.find((program) => program.id === draft.id)
    const next = copy(draft)
    next.updatedAt = clock.nowIso()
    next.revisionNumber = (existing?.revisionNumber ?? next.revisionNumber ?? 0) + 1
    next.currentRevisionId = `${next.id}:r${next.revisionNumber}`
    next.status = activate ? 'active' : 'draft'
    await storage.put('programs', next)
    await storage.put('programRevisions', createProgramRevision(next, { id: next.currentRevisionId, version: next.revisionNumber, createdAt: next.updatedAt }))
    if (activate) {
      const states = await storage.getAll('programState')
      for (const state of states) await storage.put('programState', { ...state, active: state.programId === next.id })
      await storage.put('programState', { programId: next.id, startedOn: clock.today(), active: true, revisionId: next.currentRevisionId })
    }
    programs = await storage.getAll('programs')
    draft = next
    notice = activate ? 'Program activated; your previous history is unchanged.' : 'Draft saved; nothing is active yet.'
    render()
  }

  async function start() {
    programs = await storage.getAll('programs')
    exercises = await storage.getAll('exercises')
    const active = (await storage.getAll('programState')).find((state) => state.active)
    draft = makeDraft(programs.find((program) => program.templateId === 'blank') ?? programs.find((program) => program.id === active?.programId) ?? programs[0])
    selectedDay = 0
    notice = ''
    error = ''
    replace(mount, [root])
    render()
  }

  return { root, start }
}
