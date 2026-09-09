/**
 * Positive-only companion growth.
 *
 * Care points are still derived from canonical workout and lifestyle logs.
 * These thresholds only decide when that accumulated work becomes visually
 * noticeable. Ten short steps make growth visible often without introducing
 * streaks, decay, claims, or a second currency.
 */

export const COMPANION_STYLES = Object.freeze({
  turtle: Object.freeze({ id: 'turtle', label: 'Trailback Turtle', short: 'Turtle' }),
  forge: Object.freeze({ id: 'forge', label: 'Forge Guardian', short: 'Guardian' }),
  sprout: Object.freeze({ id: 'sprout', label: 'Ember Sprout', short: 'Sprout' }),
})

export const COMPANION_LEVELS = Object.freeze([
  { min: 0, turtle: ['Egg', 'A strong shell with somewhere to go.'], forge: ['Core', 'A steady ember waiting for form.'], sprout: ['Seed', 'A tiny beginning.'], sproutVisual: 1 },
  { min: 24, turtle: ['Breaking Through', 'The first crack is progress.'], forge: ['Kindled', 'The core is awake.'], sprout: ['Stirring', 'The seed is waking.'], sproutVisual: 1 },
  { min: 50, turtle: ['Hatchling', 'Small, determined, and moving.'], forge: ['Formed', 'A frame built from consistent work.'], sprout: ['Hatchling', 'Curious and awake.'], sproutVisual: 2 },
  { min: 85, turtle: ['Young Shell', 'Bigger legs. Stronger shell.'], forge: ['Braced', 'Stronger lines and a steadier stance.'], sprout: ['Curious', 'Ready to explore the room.'], sproutVisual: 2 },
  { min: 130, turtle: ['Upright', 'Standing taller and ready to train.'], forge: ['Driven', 'Momentum is visible now.'], sprout: ['Sprout', 'Growing into its own.'], sproutVisual: 3 },
  { min: 185, turtle: ['Athletic', 'The work is changing the frame.'], forge: ['Hardened', 'Repeated effort has become structure.'], sprout: ['Growing', 'Small habits are adding up.'], sproutVisual: 3 },
  { min: 250, turtle: ['Strong', 'Built steadily, one day at a time.'], forge: ['Alloyed', 'Training and recovery move together.'], sprout: ['Bloom', 'Steady progress made visible.'], sproutVisual: 4 },
  { min: 330, turtle: ['Muscular', 'The shell is not the only armor now.'], forge: ['Vanguard', 'Built to keep moving forward.'], sprout: ['Flourish', 'The room is coming alive.'], sproutVisual: 4 },
  { min: 430, turtle: ['Cut', 'Definition earned through accumulated work.'], forge: ['Ascendant', 'A long body of work, clearly earned.'], sprout: ['Radiant', 'A long run of care, accumulated.'], sproutVisual: 5 },
  { min: 550, turtle: ['Shredded', 'Peak turtle. Progress still accumulates.'], forge: ['Sentinel', 'Fully forged. Progress still accumulates.'], sprout: ['Luminous', 'Fully grown. Care still accumulates.'], sproutVisual: 5 },
])

export function companionStyle(value) {
  return value === 'forge' || value === 'sprout' ? value : 'turtle'
}

export function companionStage(points, styleValue = 'turtle') {
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
    visual: style === 'sprout' ? level.sproutVisual : index + 1,
    style,
  }
}

export function companionGrowth(points, styleValue = 'turtle') {
  const care = Math.max(0, Number(points) || 0)
  const stage = companionStage(care, styleValue)
  const nextLevel = COMPANION_LEVELS[stage.index + 1] ?? null
  const next = nextLevel ? companionStage(nextLevel.min, styleValue) : null
  const percent = next
    ? Math.max(0, Math.min(100, Math.round(((care - stage.min) / Math.max(1, next.min - stage.min)) * 100)))
    : 100
  return { stage, next, percent }
}

/**
 * Separates earned progress from the form the user has actually revealed.
 *
 * Older builds stored only a stage name after silently rendering it. An absent
 * numeric checkpoint is therefore intentionally treated as Level 1, giving
 * existing users the reveal moment they previously missed.
 */
export function companionRevealState(points, revealedLevel, styleValue = 'turtle') {
  const style = companionStyle(styleValue)
  const earned = companionStage(points, style)
  const requested = Number.isInteger(revealedLevel) ? revealedLevel : 1
  const visibleLevel = Math.max(1, Math.min(earned.level, requested, COMPANION_LEVELS.length))
  const visible = companionStage(COMPANION_LEVELS[visibleLevel - 1].min, style)
  return {
    earned,
    visible,
    revealedLevel: visibleLevel,
    pending: earned.level > visibleLevel,
  }
}
