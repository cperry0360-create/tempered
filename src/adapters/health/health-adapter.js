/**
 * Health data contract.
 *
 * V1 ships manual entry only — HealthKit is explicitly out of scope in
 * `CLAUDE.md`. The interface exists now so that adding a device source later is
 * a new implementation rather than a change to anything that reads health data.
 *
 * @typedef {object} HealthSample
 * @property {string} date              Calendar-local YYYY-MM-DD.
 * @property {number|null} steps
 * @property {number|null} sleepHours
 * @property {number|null} waterOz
 * @property {'manual'|'device'} source
 *
 * @typedef {object} HealthAdapter
 * @property {string} kind
 * @property {() => Promise<boolean>} isAvailable
 * @property {(date: string) => Promise<HealthSample|null>} read
 * @property {(date: string, sample: Partial<HealthSample>) => Promise<void>} write
 */

export {}
