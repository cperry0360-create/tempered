/**
 * Positive-only companion growth.
 *
 * Care points are still derived from canonical workout and lifestyle logs.
 * These thresholds only decide when that accumulated work becomes visually
 * noticeable. Ten short steps make growth visible often without introducing
 * streaks, decay, claims, or a second currency.
 */

export const COMPANION_STYLES = Object.freeze({
  forge: Object.freeze({ id: 'forge', label: 'Forge Guardian', short: 'Guardian' }),
  sprout: Object.freeze({ id: 'sprout', label: 'Ember Sprout', short: 'Sprout' }),
})

export const COMPANION_LEVELS = Object.freeze([
  { min: 0, forge: ['Core', 'A steady ember waiting for form.'], sprout: ['Seed', 'A tiny beginning.'], sproutVisual: 1 },
  { min: 24, forge: ['Kindled', 'The core is awake.'], sprout: ['Stirring', 'The seed is waking.'], sproutVisual: 1 },
  { min: 50, forge: ['Formed', 'A frame built from consistent work.'], sprout: ['Hatchling', 'Curious and awake.'], sproutVisual: 2 },
  { min: 85, forge: ['Braced', 'Stronger lines and a steadier stance.'], sprout: ['Curious', 'Ready to explore the room.'], sproutVisual: 2 },
  { min: 130, forge: ['Driven', 'Momentum is visible now.'], sprout: ['Sprout', 'Growing into its own.'], sproutVisual: 3 },
  { min: 185, forge: ['Hardened', 'Repeated effort has become structure.'], sprout: ['Growing', 'Small habits are adding up.'], sproutVisual: 3 },
  { min: 250, forge: ['Alloyed', 'Training and recovery move together.'], sprout: ['Bloom', 'Steady progress made visible.'], sproutVisual: 4 },
  { min: 330, forge: ['Vanguard', 'Built to keep moving forward.'], sprout: ['Flourish', 'The room is coming alive.'], sproutVisual: 4 },
  { min: 430, forge: ['Ascendant', 'A long body of work, clearly earned.'], sprout: ['Radiant', 'A long run of care, accumulated.'], sproutVisual: 5 },
  { min: 550, forge: ['Sentinel', 'Fully forged. Progress still accumulates.'], sprout: ['Luminous', 'Fully grown. Care still accumulates.'], sproutVisual: 5 },
])

export function companionStyle(value) {
  return value === 'sprout' ? 'sprout' : 'forge'
}

export function companionStage(points, styleValue = 'forge') {
  const style = companionStyle(styleValue)
  const care = Math.max(0, Number(points) || 0)
  let index = 0
  for (const [candidate, level] of COMPANION_LEVELS.entries()) {
    if (care >= level.min) index = candidate
  }
  const level = COMPANION_LEVELS[index]
  const [name, copy] = level[style]
  return {
    index,
    level: index + 1,
    min: level.min,
    name,
    copy,
    visual: style === 'forge' ? index + 1 : level.sproutVisual,
    style,
  }
}

export function companionGrowth(points, styleValue = 'forge') {
  const care = Math.max(0, Number(points) || 0)
  const stage = companionStage(care, styleValue)
  const nextLevel = COMPANION_LEVELS[stage.index + 1] ?? null
  const next = nextLevel ? companionStage(nextLevel.min, styleValue) : null
  const percent = next
    ? Math.max(0, Math.min(100, Math.round(((care - stage.min) / Math.max(1, next.min - stage.min)) * 100)))
    : 100
  return { stage, next, percent }
}
