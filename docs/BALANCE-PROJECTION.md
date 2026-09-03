# Balance projection — starting values

Simulated against Cory's actual training week: Upper/Lower twice weekly at real working
weights, three runs, daily steps, sleep, water, reading, meditation. Consistency modelled
at 75%, which is honest rather than optimistic.

| Day | Might | Wind | Grit | Vitality | Mind |
|---|---|---|---|---|---|
| 30 | 3 | 3 | 3 | 3 | 2 |
| 60 | 4 | 4 | 4 | 3 | 3 |
| 90 | 5 | 4 | 4 | 4 | 4 |
| 180 | 6 | 6 | 6 | 6 | 5 |
| 365 | 9 | 8 | 8 | 7 | 7 |

Year-end rank **B**, 39 total attribute levels.

## Checks

- Every attribute reaches level 3 by day 60 — **pass**
- Nothing reaches the level 10 cap within a year — **pass**
- Spread at 365 is 2 levels — **pass** (target ≤ 3)

## What the first pass got wrong

The initial constants produced Vitality 10 and Might 7 at one year. Attributes fed by
*daily* activities inevitably outrun one fed by *two sessions a week*, and Might is the
headline attribute — it must not be the slowest thing in the app.

The fix was not a curve change but a rate change: Might's volume and PR values roughly
doubled, while the daily-accrual attributes came down 35–50%. Might now leads slightly,
which is correct for a training app.

## For Claude Code

Re-run this simulation in Phase 1 as a test, not as a script. If a change to
`data/balance.json` breaks any of the three checks above, the test fails. The simulation
harness belongs in `src/domain/__tests__/balance.projection.test.ts`.

These numbers are a considered starting point, not scripture. Retune freely — but
regenerate this table whenever you do.
