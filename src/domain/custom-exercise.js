/** A custom movement uses the same canonical fields as the seed library. */
export function customExercise(input, id) {
  const name = String(input.name ?? '').trim()
  if (!name || name.length > 80) throw new Error('Enter an exercise name (1–80 characters).')
  const tracking = input.tracking ?? 'reps'
  const classification = input.class ?? 'compound'
  const group = input.group ?? 'other'
  if (!['reps', 'bodyweight', 'time', 'distance'].includes(tracking)) throw new Error('Choose a tracking type.')
  if (!['compound', 'isolation'].includes(classification)) throw new Error('Choose an exercise type.')
  if (!['legs', 'posterior', 'chest', 'back', 'shoulders', 'arms', 'core', 'other'].includes(group)) throw new Error('Choose a muscle group.')
  const variant = String(input.variant ?? 'Other').trim()
  if (!variant || variant.length > 40) throw new Error('Enter equipment (1–40 characters).')
  return {
    id, name, variant, group, class: classification, source: 'user',
    unit: tracking === 'time' ? 'time' : tracking === 'bodyweight' ? 'bodyweight' : 'lbs',
    ...(tracking === 'distance' ? { metric: 'distance' } : {}),
    progression: ({ time: 'time', bodyweight: 'reps', distance: 'load', reps: 'linear' })[tracking], activation: {},
  }
}
