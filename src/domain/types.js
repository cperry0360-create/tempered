/**
 * Domain types for Tempered, as JSDoc typedefs.
 *
 * This file has no runtime exports on purpose — it is a type vocabulary only.
 * Shapes follow `docs/02-data-model.md`.
 *
 * The single most important thing in this file is what `SessionInput` does NOT
 * contain: the user's body weight. See the note on `DayInput.bodyMetrics`.
 */

/** @typedef {'might' | 'wind' | 'grit' | 'vitality' | 'mind'} AttributeId */

/** @typedef {'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'} Rank */

/**
 * One logged set. `weight` is null for bodyweight movements — the engine never
 * substitutes the user's body weight for it.
 *
 * @typedef {object} SetInput
 * @property {string} exerciseId
 * @property {number|null} weight      Load in lbs. For an exercise carrying a
 *                                     `notionalLoad`, this is the ADDED weight
 *                                     (a belt, a vest) on top of it, and null
 *                                     means the plain bodyweight variant.
 * @property {number|null} reps
 * @property {number|null} [timeSec]   For time-based holds.
 * @property {number|null} [distance]  Feet carried, for loaded carries.
 * @property {boolean} [isWarmup]      Warmup sets score nothing and set no records.
 */

/**
 * A completed training session, as the XP engine sees it.
 *
 * There is deliberately no body-weight field here, and there never may be.
 * `docs/02-data-model.md` requires a test proving it.
 *
 * @typedef {object} SessionInput
 * @property {string} id
 * @property {string|null} routineId
 * @property {number} durationMinutes
 * @property {SetInput[]} sets
 */

/**
 * @typedef {object} CardioInput
 * @property {string} activityId          'run', 'cycle', 'heavy_bag', ...
 * @property {number|null} [distanceMiles]
 * @property {number|null} [minutes]
 */

/**
 * A calendar day's non-workout logging. Values are whatever the user entered.
 *
 * `bodyMetrics` is carried here so the shape round-trips through storage, but the
 * XP engine must never read it. Only `bodyMetricsLogged` — the boolean act of
 * logging — is scored.
 *
 * @typedef {object} DayInput
 * @property {string} date                    ISO calendar-local date.
 * @property {number|null} [sleepHours]
 * @property {number|null} [waterOz]
 * @property {number|null} [steps]
 * @property {number|null} [mobilityMinutes]
 * @property {number|null} [readingMinutes]
 * @property {number|null} [studyMinutes]
 * @property {number|null} [meditationMinutes]
 * @property {number|null} [instrumentMinutes]
 * @property {boolean} [journalLogged]
 * @property {boolean} [nutritionLogged]
 * @property {boolean} [proteinTargetMet]
 * @property {boolean} [restDay]
 * @property {boolean} [bodyMetricsLogged]    The act only.
 * @property {CardioInput[]} [cardio]
 * @property {{weight?: number, bodyFat?: number}} [bodyMetrics] Stored, never scored.
 */

/**
 * One unit of XP awarded, tagged with where it came from. The `source` is what
 * powers "tap an attribute to see exactly what fed it".
 *
 * @typedef {object} Award
 * @property {AttributeId} attribute
 * @property {string} source     Stable id, e.g. 'might.volume'.
 * @property {string} label      Human-readable, e.g. 'Working volume'.
 * @property {number} xp         Always >= 0. Nothing in this app subtracts XP.
 */

/**
 * @typedef {object} ExerciseRecord
 * @property {string} exerciseId
 * @property {{weight: number, reps: number, date: string}|null} bestWeight
 * @property {{volume: number, date: string}|null} bestVolume
 * @property {{value: number, date: string}|null} bestE1RM
 * @property {{weight: number|null, reps: number|null, date: string}|null} lastPerformance
 */

/**
 * @typedef {object} Exercise
 * @property {string} id
 * @property {string} name
 * @property {'compound'|'isolation'} class
 * @property {string} [metric]
 * @property {number} [notionalLoad] Fixed lbs credited to one bodyweight rep.
 *   A per-exercise constant from `data/exercises.json`. Never the user's body
 *   weight, never derived from it.
 */

/**
 * Everything the engine needs to know that is not in the session itself.
 *
 * @typedef {object} SessionContext
 * @property {string} date
 * @property {Map<string, Exercise>} exercises
 * @property {Map<string, ExerciseRecord>} records
 * @property {number} daysSinceLastSession   Infinity for the very first session.
 * @property {number} sessionsThisWeekBefore Completed earlier in this calendar week.
 * @property {number} planTargetSessionsPerWeek
 * @property {number|null} [paceBaselineMinPerMile] Rolling 30-day baseline.
 */

/** @typedef {Record<string, number>} XpBySource */

/**
 * The shape of `data/balance.json`. Indexed loosely on purpose: balance is data,
 * and adding a tunable must not require editing a type. Nothing in the domain
 * reads this file — it is always passed in.
 *
 * @typedef {object} Balance
 * @property {number} schemaVersion
 * @property {{base: number, exponent: number, maxLevel: number}} levelCurve
 * @property {Record<string, any>} might
 * @property {Record<string, any>} wind
 * @property {Record<string, any>} grit
 * @property {Record<string, any>} vitality
 * @property {Record<string, any>} mind
 * @property {{thresholds: Record<string, number>}} rank
 * @property {{maxActive: number, targetDaysToComplete: number, neverRequireConsecutiveDays: boolean}} directive
 * @property {Record<string, any>} progressionDefaults
 * @property {Record<string, any>} [battle]
 */

export {}
