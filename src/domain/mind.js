/**
 * Mind — learning, focus, stillness. Mostly marked, duration-scaled where a
 * duration exists.
 *
 * The daily cap scales the whole day's Mind awards proportionally rather than
 * truncating the last one, so the breakdown the user sees still sums to the
 * total they were given.
 */

import { applyDailyCap } from './curves.js'

/**
 * @param {import('./types.js').DayInput} day
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function mindAwards(day, balance) {
  const mind = balance.mind
  /** @type {import('./types.js').Award[]} */
  const awards = []

  /** @param {string} source @param {string} label @param {number} xp */
  const add = (source, label, xp) => {
    if (xp > 0) awards.push({ attribute: 'mind', source, label, xp })
  }

  /** @param {number|null|undefined} value */
  const minutes = (value) => (typeof value === 'number' && value > 0 ? value : 0)

  add('mind.reading', 'Reading', minutes(day.readingMinutes) * mind.xpPerReadingMinute)
  add('mind.study', 'Study or practice', minutes(day.studyMinutes) * mind.xpPerStudyMinute)
  add('mind.meditation', 'Meditation', minutes(day.meditationMinutes) * mind.xpPerMeditationMinute)

  // Instrument practice is deliberate skill practice, scored at the study rate.
  add('mind.instrument', 'Instrument practice', minutes(day.instrumentMinutes) * mind.xpPerStudyMinute)

  if (day.journalLogged === true) add('mind.journal', 'Journal', mind.journalXp)

  return applyDailyCap(awards, mind.dailyMindCapXp)
}
