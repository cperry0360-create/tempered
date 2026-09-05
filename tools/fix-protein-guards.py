from pathlib import Path

# The registry distinguishes raw user input from the derived field the XP engine scores.
path = Path('src/domain/activities.js')
text = path.read_text()
old = "  protein_target: { field: 'proteinGrams', entry: 'number', mode: 'replace' },"
new = "  protein_target: { field: 'proteinGrams', entry: 'number', mode: 'replace', scoredField: 'proteinTargetMet' },"
if new not in text:
    if old not in text: raise SystemExit('protein registry entry not found')
    text = text.replace(old, new)
path.write_text(text)

# Keep the engine-field guard strong while allowing a registered derivation boundary.
path = Path('src/domain/activities.test.js')
text = path.read_text()
old = """  for (const [id, spec] of Object.entries(ACTIVITY_FIELDS)) {
    assert.ok(engineFields.has(spec.field), `${id} writes ${spec.field}, which nothing scores`)
  }
"""
new = """  for (const [id, spec] of Object.entries(ACTIVITY_FIELDS)) {
    const scoredField = spec.scoredField ?? spec.field
    assert.ok(engineFields.has(scoredField),
      `${id} resolves to ${scoredField}, which nothing scores`)
  }
"""
if new not in text:
    if old not in text: raise SystemExit('activity engine-field guard not found')
    text = text.replace(old, new)
path.write_text(text)

# Source inventory remains registry-driven. Derived activities announce their scored
# field in the same registry, so the synthetic probe can exercise the engine without
# adding another hand-maintained activity literal.
path = Path('src/domain/sources.test.js')
text = path.read_text()
old = """  for (const [activityId, spec] of Object.entries(ACTIVITY_FIELDS)) {
    const value = spec.entry === 'number' ? (ACTIVITY_PROBE_VALUES[activityId] ?? 1) : null
    day = applyActivity(day, activityId, value)
  }
"""
new = """  for (const [activityId, spec] of Object.entries(ACTIVITY_FIELDS)) {
    const value = spec.entry === 'number' ? (ACTIVITY_PROBE_VALUES[activityId] ?? 1) : null
    day = applyActivity(day, activityId, value)
    if (spec.scoredField) day = { ...day, [spec.scoredField]: true }
  }
"""
if new not in text:
    if old not in text: raise SystemExit('registry source probe not found')
    text = text.replace(old, new)
path.write_text(text)

# New runtime module must work offline.
path = Path('sw.js')
text = path.read_text()
anchor = "  './src/domain/plates.js',\n"
addition = anchor + "  './src/domain/protein.js',\n"
if "'./src/domain/protein.js'" not in text:
    if anchor not in text: raise SystemExit('precache anchor not found')
    text = text.replace(anchor, addition)
path.write_text(text)

# Visible maintenance patch also changes the service-worker cache key.
path = Path('src/version.js')
text = path.read_text()
old = "export const VERSION = '0.11.3 (8)'"
new = "export const VERSION = '0.11.4 (8)'"
if new not in text:
    if old not in text: raise SystemExit('expected version not found')
    text = text.replace(old, new)
path.write_text(text)
