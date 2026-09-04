/**
 * Titles — permanent awards for crossing thresholds.
 *
 * `docs/01-attributes-and-xp.md`: flavour only, no mechanical effect. The
 * catalogue lives in `data/titles.json` with its conditions written in English;
 * this module is where those sentences become predicates, and `titles.test.js`
 * checks the two lists cannot drift apart in either direction.
 *
 * Nothing here punishes. A title is a record of something that happened, so a
 * rule is always a floor — passing further beyond a threshold never removes
 * what crossing it earned, and no fact can un-earn a title once it is stored.
 *
 * Pure: the facts arrive as an object. Gathering them from storage is the app
 * layer's job, in `src/app/character.js`.
 */

/**
 * @typedef {object} TitleFacts
 * @property {Record<string, number>} levels     Level per attribute.
 * @property {number} sessionCount               Sessions finished, lifetime.
 * @property {number} trainingHours              Hours under load, lifetime.
 * @property {number} milesCovered               Cardio miles, lifetime.
 * @property {number} inBandSleeps               Nights logged inside the sleep band.
 * @property {number} bestDeadliftLbs
 * @property {number} bestCarryLoadLbs
 * @property {number} daysSinceFirstSession
 * @property {boolean} restAfterThreeTrainingDays
 * @property {boolean} returnedAfterGap
 */

const level = (attribute, at) => (facts) => (facts.levels?.[attribute] ?? 0) >= at
const atLeast = (fact, threshold) => (facts) => (facts[fact] ?? 0) >= threshold
const did = (fact) => (facts) => facts[fact] === true

/**
 * One predicate per title in the catalogue, keyed by id.
 *
 * Each is written to match the catalogue's stated condition exactly, because
 * the condition is what the user is shown. A rule that is stricter or looser
 * than the sentence beside it makes the app a liar in a place where it is
 * trying to be generous.
 *
 * @type {Readonly<Record<string, (facts: TitleFacts) => boolean>>}
 */
export const TITLE_RULES = Object.freeze({
  // Complete your first session
  first_load: atLeast('sessionCount', 1),
  // Log a rest day after three consecutive training days
  tempered: did('restAfterThreeTrainingDays'),
  // Train again after four or more days away
  returned: did('returnedAfterGap'),
  // Reach Might level 6
  heavy_resistance: level('might', 6),
  // Sleep in the seven-to-nine band twenty times
  unhurried: atLeast('inBandSleeps', 20),
  // Accumulate 100 miles
  long_road: atLeast('milesCovered', 100),
  // Reach 100 training hours
  hundred_hours: atLeast('trainingHours', 100),
  // Reach Mind level 5
  quiet_mind: level('mind', 5),
  // Reach Grit level 7
  ironclad: level('grit', 7),
  // Deadlift 315 lbs
  three_plates: atLeast('bestDeadliftLbs', 315),
  // Farmer's carry 200 lbs total load
  carried: atLeast('bestCarryLoadLbs', 200),
  // Reach level 4 in all five attributes
  balanced: (facts) => ['might', 'wind', 'grit', 'vitality', 'mind']
    .every((attribute) => (facts.levels?.[attribute] ?? 0) >= 4),
  // Train across 365 days from first session
  one_year: atLeast('daysSinceFirstSession', 365),
})

/**
 * Which titles these facts have earned, in catalogue order.
 *
 * @param {Partial<TitleFacts>} [facts]
 * @param {{id: string, name: string, condition: string, attribute: string|null}[]} [catalogue]
 * @returns {{id: string, name: string, condition: string, attribute: string|null}[]}
 */
export function earnedTitles(facts, catalogue) {
  const known = facts ?? {}
  return (catalogue ?? []).filter((title) => {
    const rule = TITLE_RULES[title.id]
    // An unruled title is not earnable rather than automatically earned. The
    // test above makes sure there are none, but silence beats a false award.
    return typeof rule === 'function' && rule(known) === true
  })
}
