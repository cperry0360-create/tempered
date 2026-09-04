/**
 * Tier names, transcribed from the table in `docs/01-attributes-and-xp.md`.
 *
 * These are content, not balance: index 0 is the level-0 name, index 10 the
 * level-10 name. They carry the fantasy without a single drawing, which is why
 * `docs/04-design-system.md` can get away with almost no art. They never need
 * tuning, so they live here rather than in `data/`.
 *
 * @type {Readonly<Record<import('./types.js').AttributeId, readonly string[]>>}
 */
export const TIER_NAMES = Object.freeze({
  might: Object.freeze([
    'Untrained', 'Novice', 'Capable', 'Strong', 'Powerful', 'Formidable',
    'Elite', 'Brutal', 'Titanic', 'Monstrous', 'Mythic',
  ]),
  wind: Object.freeze([
    'Sedentary', 'Winded', 'Steady', 'Enduring', 'Tireless', 'Relentless',
    'Swift', 'Effortless', 'Boundless', 'Untiring', 'Immortal',
  ]),
  grit: Object.freeze([
    'Untested', 'Willing', 'Consistent', 'Dependable', 'Disciplined', 'Unwavering',
    'Ironclad', 'Immovable', 'Indomitable', 'Absolute', 'Adamant',
  ]),
  vitality: Object.freeze([
    'Depleted', 'Fragile', 'Recovering', 'Steady', 'Restored', 'Robust',
    'Vigorous', 'Thriving', 'Radiant', 'Peerless', 'Undying',
  ]),
  mind: Object.freeze([
    'Idle', 'Curious', 'Attentive', 'Studious', 'Sharp', 'Incisive',
    'Astute', 'Penetrating', 'Luminous', 'Profound', 'Transcendent',
  ]),
})

/** @type {readonly import('./types.js').AttributeId[]} */
export const ATTRIBUTE_IDS = Object.freeze(['might', 'wind', 'grit', 'vitality', 'mind'])

/**
 * The tier name for an attribute at a level.
 *
 * @param {import('./types.js').AttributeId} attribute
 * @param {number} level
 * @returns {string}
 */
export function tierName(attribute, level) {
  const names = TIER_NAMES[attribute]
  const index = Math.max(0, Math.min(names.length - 1, Math.trunc(level)))
  return /** @type {string} */ (names[index])
}
