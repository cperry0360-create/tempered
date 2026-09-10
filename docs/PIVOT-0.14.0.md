# Tempered 0.14.0 — tracker-first pivot

## Product direction

Tempered is now a health, lifestyle, and strength tracker with a deliberately small Companion reward layer. Normal navigation is Today, Train, Companion, Progress. Character/Battle remain internal only for backwards-compatible stored data and regression coverage.

## Companion

- Five positive-only growth stages: Seed, Hatchling, Sprout, Bloom, Radiant.
- Growth is derived from accumulated completed training, working sets, and lifestyle logging.
- Missing days never reduce growth or remove unlocks.
- A small habitat gains room objects as care accumulates.
- Daily moments reflect training, hydration, reading, nutrition, sleep, or simply hanging out.
- Companion name is user editable.

## Progress dashboard

- Existing recap remains fixed at the top.
- Configurable widget grid below it.
- Add-widget gallery, Edit/Done mode, minus-circle removal, touch-friendly reordering, local layout persistence.
- Initial widgets: Training Load, Sleep, Steps, Nutrition, Water, Weight, Body Metrics, Consistency, Micro Cardio.
- Body Metrics supports Shortcut-imported resting HR, HRV, respiratory rate, SpO2, and body temperature.

## Apple Health Shortcut bridge

The static Home Screen PWA cannot read HealthKit directly. 0.14.0 adds a light-touch iPhone Shortcut path instead:

- Shortcut reads Health data on-device.
- It emits a small `TEMPERED_HEALTH_V1` snapshot.
- Tempered imports Steps, decimal Sleep, and Weight through canonical trackers.
- Resting HR, HRV, respiratory rate, SpO2, and body temperature are saved for dashboard widgets.
- Repeated sync replaces totals rather than doubling them.
- Settings includes a copyable Shortcut recipe and import action; Today exposes the normal Import Health gesture.

No Mac, Apple Developer account, server, or embedded AI provider is required for this bridge.

## Visual identity

Normal product surfaces now use first-party wellness and companion art under `art/tempered/`, replacing the visible RPG/night-forest identity. Today, Train, Progress, and Companion each have their own local background treatment. Companion art is bundled locally and precached for offline use.

## Workout completion

The visible post-workout summary is tracker-first: session recap, new records, and an explicit companion-growth payoff showing exact care from the workout and its working sets. It can route directly to Companion for an earned evolution, while the transformation itself still waits for that dedicated screen. No visible character XP, ranks, combat stats, or RPG directives remain in the completion flow.

## Compatibility

The old RPG implementation is intentionally not destructively deleted in this release. Existing IndexedDB records and JSON backups remain readable, and legacy regression fixtures can still exercise the hidden code paths. Future work should not expand the RPG.
