/**
 * Equipment is a way of performing a movement, not a different movement.
 *
 * The exercise id remains canonical for programming, completion, activation,
 * and XP. `method` is stored on each set so loads and history can still be read
 * in the context in which they were performed.
 */

/** The curated methods an exercise can use, with its shipped variant first. */
export function methodsForExercise(exercise) {
  const methods = Array.isArray(exercise?.methods) ? exercise.methods : []
  return [...new Set([exercise?.variant, ...methods].filter(Boolean))]
}

/** A saved choice is valid only while the exercise still advertises it. */
export function methodForExercise(exercise, selected = null) {
  const methods = methodsForExercise(exercise)
  return methods.includes(selected) ? selected : (methods[0] ?? null)
}

/**
 * Old logs predate the method field. They belong to the exercise's original
 * variant, which preserves all existing history without inventing conversions.
 */
export function methodForSet(set, exercise) {
  return set?.method ?? exercise?.variant ?? null
}

export function setUsesMethod(set, exercise, method) {
  return !method || methodForSet(set, exercise) === method
}
