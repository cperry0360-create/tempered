# Tempered native iOS wrapper

This target keeps the existing local-first web application intact and adds the one
capability a home-screen PWA cannot provide directly: HealthKit.

## What it does

- Opens the production Tempered origin in a persistent `WKWebView`.
- Exposes a very small JavaScript bridge named `temperedHealth`.
- Requests **read-only** HealthKit access to:
  - Steps (`HKQuantityTypeIdentifierStepCount`)
  - Sleep analysis (`HKCategoryTypeIdentifierSleepAnalysis`)
- Imports today's steps and the previous night's sleep into Tempered's existing
  `dayLogs` store.
- Re-syncs when the native app returns to the foreground.
- Never writes anything to Apple Health.
- If HealthKit is unavailable, denied, or has no sample, Tempered's existing manual
  entry remains available.

Sleep is assigned to the **wake date**. The native reader looks from noon the previous
day to noon on the requested date, counts only asleep stages, and unions overlapping
samples so `inBed`/`awake` records and overlapping sleep-stage records do not inflate the
total.

## First install

1. On the existing PWA, open **Settings** and save a JSON backup.
2. On a Mac with Xcode, open `native/ios/Tempered.xcodeproj`.
3. Select the **Tempered** target → **Signing & Capabilities**.
4. Choose your Apple Developer team. If Xcode asks, change
   `com.cperry0360.tempered` to a bundle identifier owned by that team.
5. Confirm the HealthKit capability is present. The project already contains the
   `com.apple.developer.healthkit` entitlement and the required read-usage message.
6. Build to a **physical iPhone**.
7. On first launch, allow Tempered to read Steps and Sleep when iOS presents the
   Health permission sheet.
8. In the native Tempered app, import the JSON backup you saved in step 1.

The backup/import step is required once because a native `WKWebView` has its own website
storage container; it cannot read the IndexedDB database owned by the Safari/PWA install.
After that migration, the native app is the intended install.

## Updates

The native shell loads:

`https://cperry0360-create.github.io/tempered/`

so normal Tempered web releases continue to deploy through GitHub Pages. The shell does
not need to be rebuilt for ordinary HTML/CSS/JavaScript releases. A new native build is
needed only when Swift/entitlements/native behavior changes.

## Privacy behavior

HealthKit intentionally does not tell an app whether the user denied **read** permission
for a particular type. A successful authorization request means the permission flow
completed, not that every requested type was granted. If a type is denied, the query
looks the same as if there were no readable samples. Tempered therefore falls back to
manual entry instead of treating missing Health data as an error.
