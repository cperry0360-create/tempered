/**
 * What feeds an attribute, and what each thing is worth.
 *
 * `docs/03-screens.md` calls the expanded attribute view mandatory, and it is
 * the app's answer to the only question that matters about a progression layer:
 * *why did that go up*. `CLAUDE.md` non-negotiable 3 says the mapping must be
 * legible; this module is where legibility is actually written down.
 *
 * Two halves:
 *
 *   - `explainSources` — what CAN feed this attribute, and the rate. Read
 *     straight out of `data/balance.json`, so retuning balance retunes the
 *     explanation with no code change. A screen that quotes a number the engine
 *     no longer uses is worse than a screen that quotes none.
 *   - `topContributors` — what DID feed it, from `lifetimeSources`.
 *
 * `sources.test.js` drives the XP engine and checks this list against every
 * source it can actually emit, in both directions. A hand-maintained list of
 * "things that give you Might" is true the day it is written and quietly wrong
 * six weeks later.
 */

/**
 * The name each source goes by, matching the labels the engine puts on its own
 * awards so the post-session breakdown and the Character screen agree.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SOURCE_LABELS = Object.freeze({
  'might.volume': 'Working volume',
  'might.weightPr': 'Weight PR',
  'might.volumePr': 'Volume PR',
  'might.e1rm': 'Estimated 1RM gain',
  'might.carry': 'Loaded carries',

  'wind.distance': 'Distance covered',
  'wind.minutes': 'Cardio minutes',
  'wind.steps': 'Steps',
  'wind.pace': 'Pace improvement',

  'grit.session': 'Trained today',
  'grit.hours': 'Time under load',
  'grit.weekPlan': 'Week met plan',
  'grit.return': 'Back after time away',

  'vitality.sleep': 'Sleep',
  'vitality.water': 'Hydration',
  'vitality.protein': 'Protein target met',
  'vitality.nutrition': 'Nutrition logged',
  'vitality.calories': 'Calories tracked',
  'vitality.alcoholFree': 'Alcohol-free day',
  'vitality.rest': 'Rest day taken',
  'vitality.sauna': 'Sauna',
  'vitality.bodyMetrics': 'Body metrics logged',

  'mind.reading': 'Reading',
  'mind.study': 'Study or practice',
  'mind.meditation': 'Meditation',
  'mind.instrument': 'Instrument practice',
  'mind.journal': 'Journal',
})

/**
 * What each source is worth, phrased from balance rather than from memory.
 *
 * Every entry reads its numbers out of the balance object it is handed. That is
 * the whole point: `CLAUDE.md` non-negotiable 7 puts balance in config, and an
 * explanation with the old rate baked into a string would make that a lie the
 * first time a number moved.
 *
 * @type {Readonly<Record<string, (balance: import('./types.js').Balance) => string>>}
 */
const SOURCE_WORTH = Object.freeze({
  'might.volume': (b) => `${b.might.xpPerThousandLbsVolume} XP per 1,000 lbs moved, tapering past ${n(b.might.volumeSoftCapLbs)} in a session`,
  'might.weightPr': (b) => `${b.might.weightPrBonus} XP for a weight PR`,
  'might.volumePr': (b) => `${b.might.volumePrBonus} XP for a volume PR`,
  'might.e1rm': (b) => `${b.might.e1rmGainXpPerLb} XP per lb of estimated 1RM gained`,
  'might.carry': (b) => `${b.might.carryXpPerLbPerHundredFeet} XP per lb carried, per 100 feet`,

  'wind.distance': (b) => `${b.wind.xpPerMile} XP per mile, tapering past ${b.wind.mileSoftCapPerDay} in a day`,
  'wind.minutes': (b) => `${b.wind.xpPerCardioMinute} XP per cardio minute`,
  'wind.steps': (b) => `${b.wind.xpPerThousandSteps} XP per 1,000 steps, counted to ${n(b.wind.stepsDailyCap)} a day`,
  'wind.pace': (b) => `${b.wind.paceImprovementBonus} XP for beating your own ${b.wind.paceBaselineDays}-day pace. A slower day costs nothing`,

  'grit.session': (b) => `${b.grit.xpPerSession} XP for a day you trained, whatever the training was`,
  'grit.hours': (b) => `${b.grit.xpPerTrainingHour} XP per hour under load`,
  'grit.weekPlan': (b) => `${b.grit.weekMetPlanBonus} XP for a week that meets your plan`,
  'grit.return': (b) => `${b.grit.returnAfterGapBonus} XP for the first session back after ${b.grit.returnGapDaysThreshold} or more days away`,

  'vitality.sleep': (b) => `${b.vitality.sleepXpInBand} XP in the ${b.vitality.sleepBandHours[0]}–${b.vitality.sleepBandHours[1]} hour band, ${b.vitality.sleepXpNearBand} near it, ${b.vitality.sleepXpOutOfBand} outside. More is not better`,
  'vitality.water': (b) => `${b.vitality.xpPerOunceWater} XP per ounce, counted to ${b.vitality.waterDailyCapOz} a day`,
  'vitality.protein': (b) => `${b.vitality.proteinTargetBonus} XP for hitting your protein target`,
  'vitality.nutrition': (b) => `${b.vitality.nutritionLoggedXp} XP for logging your food honestly`,
  'vitality.calories': (b) => `${b.vitality.caloriesLoggedXp} XP for tracking calories. The calorie number itself is not scored`,
  'vitality.alcoholFree': (b) => `${b.vitality.alcoholFreeXp} XP for an alcohol-free day`,
  'vitality.rest': (b) => `${b.vitality.restDayXp} XP for a rest day. Recovery is half the process`,
  'vitality.sauna': (b) => `${b.vitality.saunaXp} XP for a sauna session`,
  'vitality.bodyMetrics': (b) => `${b.vitality.bodyMetricsLoggedXp} XP for the act of measuring. The number itself is never scored`,

  'mind.reading': (b) => `${b.mind.xpPerReadingMinute} XP per minute read`,
  'mind.study': (b) => `${b.mind.xpPerStudyMinute} XP per minute of study`,
  'mind.meditation': (b) => `${b.mind.xpPerMeditationMinute} XP per minute of stillness`,
  'mind.instrument': (b) => `${b.mind.xpPerStudyMinute} XP per minute of practice`,
  'mind.journal': (b) => `${b.mind.journalXp} XP for a journal entry`,
})

/** Thousands separated, so a soft cap reads as 14,000 rather than 14000. */
const n = (value) => Number(value).toLocaleString('en-US')

/** A source id with no label — retired, or from a future version's data. */
function fallbackLabel(source) {
  const tail = String(source).split('.').slice(1).join('.') || String(source)
  const spaced = tail.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * @typedef {object} SourceExplanation
 * @property {string} source
 * @property {string} label
 * @property {string} worth   Phrased from balance, e.g. "195 XP for a rest day".
 */

/**
 * Everything that can raise this attribute, in the order the list is written —
 * biggest and most characteristic first, so the first line answers the question
 * for most people.
 *
 * @param {import('./types.js').AttributeId} attribute
 * @param {import('./types.js').Balance} balance
 * @returns {SourceExplanation[]}
 */
export function explainSources(attribute, balance) {
  return Object.keys(SOURCE_WORTH)
    .filter((source) => source.startsWith(`${attribute}.`))
    .map((source) => ({
      source,
      label: SOURCE_LABELS[source] ?? fallbackLabel(source),
      worth: SOURCE_WORTH[source](balance),
    }))
}

/**
 * @typedef {object} Contribution
 * @property {string} source
 * @property {string} label
 * @property {number} xp
 * @property {number} share  Of this attribute's lifetime total, 0 to 1.
 */

/**
 * What actually fed this attribute, biggest first.
 *
 * Drawn from `lifetimeSources`, which the XP engine has been accumulating since
 * Phase 1 for exactly this. A source with nothing in it is not a contributor and
 * is left out rather than shown as a zero.
 *
 * @param {import('./types.js').AttributeId} attribute
 * @param {Record<string, number>} [lifetimeSources]
 * @param {number} [limit]
 * @returns {Contribution[]}
 */
export function topContributors(attribute, lifetimeSources, limit = 5) {
  const mine = Object.entries(lifetimeSources ?? {})
    .filter(([source, xp]) => source.startsWith(`${attribute}.`) && xp > 0)
    .sort((a, b) => b[1] - a[1])

  const total = mine.reduce((sum, [, xp]) => sum + xp, 0)
  return mine.slice(0, limit).map(([source, xp]) => ({
    source,
    label: SOURCE_LABELS[source] ?? fallbackLabel(source),
    xp,
    share: total > 0 ? xp / total : 0,
  }))
}
