# LFMS deep-screen visual audit — 0.66.19

Scope: **presentation only**. Canonical data (IndexedDB), calculations, navigation handlers, backup/restore, and offline sync are unchanged. This is a design audit, not a replacement for native iOS screenshots.

## Design rules

- LFMS deep navy canvas, blue primary actions and progress, hairline blue borders, white text, muted blue secondary text.
- Use the existing logo red (token `--lfms-launch-red`) for **small** emphasis: a section marker, title dot, selected indicator, high-value milestone, or genuine destructive-warning copy.
- Do not recolor all controls red; red must not compete with workout performance graphs, nutrition macro signals, or the selected blue glass navigation lens.
- Scope new styling to old screens. Respect minimum 44px targets, focus styles and reduced-motion preference.
- Both installed Duo and ordinary portrait Safari/Home Screen should use the same palette. No changes to the user's Duo setting or app install identity.

## Inventory and action

| Flow | Drill-downs and overlays | Audit finding and resolution |
|---|---|---|
| Today | week/day details, Daily Log, Mobility routines, Health import | Today dashboard already LFMS. Mobility full-screen routine sheets and Health paste inherited gray; moved to blue cards/navy and added small brand marker. Retained logs and confirmations. |
| Train | rhythm, program details, routine preview, exercise library, custom exercise, plate calculator | Train subheaders and rows already had blue styling. Program Builder and plate-calculator surfaces inherited gray; restyled with navy panels, blue selects and red selected-day stroke. Exercise library data/illustrations untouched. |
| Live workout | expanded session, half-fold, add movement, finish/rest, pause/exit, summary and records | Preserve exercise media, data entry and layout. Change old orange/gray progress and summary cards to blue/navy; use red on achievement eyebrow and selected exercise rail focus only. |
| Fuel | Food Library, Quick Log, Meal History, serving sheet, nutrition log/review | Food 2.0 already uses its own approved navy/blue design. Preserve macro category colors and portion flows. Align remaining standalone nutrition overlay with navy. |
| Progress | trends, score details/explanations, lift detail, habits, log/session detail, Beach Cut | Progress panels already use navy. Color-cut eyebrow now subtly carries logo red. Score explanation and adjacent dialog surface moved to the deeper palette; chart semantics and values untouched. |
| Settings | Appearance/Duo, Plan, Program Library, Away, Your Data, Credits, Build, Reset | Most visually obsolete: charcoal slabs, gray fields and older buttons. Now consistent gradient canvas, blue outlined panels, clean inputs, blue primary action, red section marker. Reset danger remains clearly differentiated. |
| Setup | welcome, cadence, plan and related selectors | Scoped modern navy cards, blue selection controls, red kicker; values and profile setup unchanged. |
| Recap / utilities | Weekly Recap, Health review, quick cardio, plate calculator | Matching navy backdrops/panels and blue actions. Kept domain-specific safety/confirmation behavior. |
| Battle/companion legacy | separate game/companion worlds | Purposefully preserved rather than flattening bespoke art/themes into tracker styling. |

## Visual QA

The release capture tool covers dozens of ordinary iPhone views. Duo coverage includes both cover and inner screens plus additional Settings, Mobility, Program Builder, Summary, Training detail/library, Progress score/lift details, and Health Review. The visual fixture also verifies that the key formerly legacy screens have inherited the new LFMS palette before reporting a screenshot as successful.

## Non-goals

No new workout features, no deletion of previous style logic, no data migrations, no changes to locally stored personal data, and no removal of established screens. Future detailed polish should start from actual screenshot/user feedback, not broad unscoped overrides.
