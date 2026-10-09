import { el } from './dom.js'

/** Shared local-library creation form; saving errors leave every input intact. */
export function customExerciseForm({ workout, name = '', onSave, onCancel }) {
  const input = { name, group: 'other', variant: 'Other', class: 'compound', tracking: 'reps' }
  const notice = el('p.notice', { role: 'alert' })
  const select = (label, key, choices) => el('label.custom-exercise__field', {}, [label,
    el('select', { 'aria-label': label, onchange: (event) => { input[key] = event.target.value } },
      choices.map(([value, text]) => el('option', { value }, [text]))),
  ])
  const save = el('button.button.button--primary', { type: 'submit' }, ['Save exercise'])
  return el('form.custom-exercise', {
    dataset: { customExerciseForm: 'true' },
    onsubmit: async (event) => {
      event.preventDefault()
      if (save.disabled) return
      save.disabled = true
      try { await onSave(await workout.createExercise(input)) }
      catch (error) { notice.textContent = error.message; save.disabled = false }
    },
  }, [
    el('h2', { text: 'Create custom exercise' }),
    el('label.custom-exercise__field', {}, ['Exercise name', el('input', { value: name, required: true, maxLength: 80, 'aria-label': 'Exercise name', oninput: (event) => { input.name = event.target.value } })]),
    el('label.custom-exercise__field', {}, ['Equipment', el('input', { value: 'Other', required: true, maxLength: 40, 'aria-label': 'Equipment', oninput: (event) => { input.variant = event.target.value } })]),
    select('Muscle group', 'group', ['other', 'legs', 'posterior', 'chest', 'back', 'shoulders', 'arms', 'core'].map((value) => [value, value === 'other' ? 'Other / unspecified' : value])),
    select('Exercise type', 'class', [['compound', 'Compound'], ['isolation', 'Isolation']]),
    select('Track', 'tracking', [['reps', 'Weight + reps'], ['bodyweight', 'Bodyweight reps'], ['time', 'Time (seconds)'], ['distance', 'Weight + distance (feet)']]),
    el('p', { text: 'Saved on this device and included in your backups. Muscle activation and bodyweight load credit are not estimated.' }),
    notice,
    el('div.custom-exercise__actions', {}, [save, el('button.button', { type: 'button', onclick: onCancel }, ['Cancel'])]),
  ])
}
