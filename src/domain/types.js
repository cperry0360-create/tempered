/**
 * Domain types for Tempered, as JSDoc typedefs.
 */

/** @typedef {'might' | 'wind' | 'grit' | 'vitality' | 'mind'} AttributeId */
/** @typedef {'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'} Rank */

/**
 * @typedef {object} SetInput
 * @property {string} exerciseId
 * @property {number|null} weight
 * @property {number|null} reps
 * @property {number|null} [timeSec]
 * @property {number|null} [distance]
 * @property {boolean} [isWarmup]
 */

/**
 * @typedef {object} SessionInput
 * @property {string} id
 * @property {string|null} routineId
 * @property {number} durationMinutes
 * @property {SetInput[]} sets
 */

/**
 * @typedef {object} CardioInput
 * @property {string} activityId
 * @property {number|null} [distanceMiles]
 * @property {number|null} [minutes]
 */

/**
 * A calendar day's non-workout logging. Body metric values round-trip through
 * storage but are never used for scoring; only bodyMetricsLogged is scored.
 *
 * @typedef {object} DayInput
 * @property {string} date
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
 * @property {boolean} [caloriesLogged]
 * @property {boolean} [proteinTargetMet]
 * @property {boolean} [alcoholFree]
 * @property {boolean} [saunaLogged]
 * @property {boolean} [restDay]
 * @property {boolean} [bodyMetricsLogged]
 * @property {CardioInput[]} [cardio]
 * @property {{weight?: number, bodyFat?: number}} [bodyMetrics]
 */

/**
 * @typedef {object} Award
 * @property {AttributeId} attribute
 * @property {string} source
 * @property {string} label
 * @property {number} xp
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
 * @property {number} [notionalLoad]
 */

/**
 * @typedef {object} SessionContext
 * @property {string} date
 * @property {Map<string, Exercise>} exercises
 * @property {Map<string, ExerciseRecord>} records
 * @property {number} daysSinceLastSession
 * @property {number} sessionsThisWeekBefore
 * @property {number} planTargetSessionsPerWeek
 * @property {number|null} [paceBaselineMinPerMile]
 */

/** @typedef {Record<string, number>} XpBySource */

/**
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
