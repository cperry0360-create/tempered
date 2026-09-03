# 02 — Data model

All types live in `src/domain/types.js` as JSDoc `@typedef`s. Storage is IndexedDB behind an adapter; the
shapes below are what the adapter persists and what export/import round-trips.

## Object stores

```
profile          one record
sessions         one per completed workout
setLogs          one per logged set, indexed by sessionId and exerciseId
dayLogs          one per calendar day: activities, metrics, rest
exercises        seed + user additions
routines         seed + user additions
attributeState   current XP and level per attribute
records          PRs per exercise
titles           earned titles
battles          one per day, with seed and resolved result
directive        one active record
```

## Core shapes

```ts
type AttributeId = 'might' | 'wind' | 'grit' | 'vitality' | 'mind';

interface Profile {
  name: string;
  createdAt: ISODate;
  units: 'imperial' | 'metric';
  planTargetSessionsPerWeek: number;
  schemaVersion: number;
}

interface Session {
  id: string;
  routineId: string | null;      // null for ad-hoc
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  notes?: string;
}

interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weight: number | null;         // null for bodyweight
  reps: number | null;
  timeSec: number | null;        // for time-based
  distance: number | null;       // for carries and cardio
  completedAt: ISODateTime;
  isWarmup: boolean;
}

interface DayLog {
  date: ISODate;                 // the key
  activities: Record<string, number | true>;  // activityId -> value, or true if marked
  restDay: boolean;
  bodyMetrics?: { weight?: number; bodyFat?: number };  // stored, NEVER scored
}

interface AttributeState {
  attribute: AttributeId;
  xp: number;
  level: number;                 // derived, cached
  lifetimeSources: Record<string, number>;  // sourceId -> xp contributed, for the
                                            // "why did this grow" view
}

interface ExerciseRecord {
  exerciseId: string;
  bestWeight: { weight: number; reps: number; date: ISODate } | null;
  bestVolume: { volume: number; date: ISODate } | null;
  bestE1RM: { value: number; date: ISODate } | null;
  lastPerformance: { weight: number|null; reps: number|null; date: ISODate } | null;
}
```

## Rules

**`lifetimeSources` is required.** It is what powers "tap an attribute to see exactly
what fed it." Without it the progression is a black box, which breaks the legibility
principle in `CLAUDE.md`.

**Body metrics are stored but never read by the XP engine.** Enforce this with a test:
the engine's session input type must not include body weight at all.

**Dates are calendar-local, not UTC.** A workout at 11pm belongs to that day. Use the
clock adapter so this is testable.

**Battles are keyed and seeded by date.** `seed = hash(profileId + date)`. Re-resolving
must produce an identical result, so a battle can never be rerolled for better loot.

## Export format

```json
{
  "app": "tempered",
  "schemaVersion": 1,
  "exportedAt": "...",
  "data": { "profile": {}, "sessions": [], "setLogs": [], "dayLogs": [],
            "attributeState": [], "records": [], "titles": [], "battles": [],
            "exercises": [], "routines": [] }
}
```

Import: validate `app` and `schemaVersion` first. Refuse a mismatch with a clear
message. Never merge silently — always ask replace or cancel.

## Migrations

Every schema change bumps `schemaVersion` and adds a migration in
`src/domain/migrations/`. Migrations are pure functions and must be tested against a
fixture of the previous version.
