/**
 * The language rules, enforced.
 *
 * `CLAUDE.md` non-negotiable 9 names words to prefer and words to avoid, and
 * `docs/10-task-model.md` adds a hard one: nothing anywhere may render an
 * outstanding item as overdue, late, missed or failed. Absence is not failure,
 * and an unfinished slot is work still available.
 *
 * This checks the copy itself rather than the styling, because a neutral colour
 * on the word "overdue" is still the word "overdue".
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

/** Screen modules — the only place user-facing copy is written. */
function uiSources(dir = 'src/ui', found = []) {
  for (const entry of readdirSync(root + dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) uiSources(path, found)
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) found.push(path)
  }
  return found
}

/**
 * The words a user actually reads.
 *
 * Deliberately narrow: `text:` values and the string children of an element.
 * A blunter extractor that took every string literal reported `loading: 'lazy'`
 * and `console.error('... failed')` as copy, which is noise — and noise in a
 * rule like this gets the rule switched off.
 */
function visibleCopy(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  const strings = []
  // text: '...' / text: `...`
  for (const match of withoutComments.matchAll(/\btext:\s*(?:'([^']*)'|`([^`]*)`)/g)) {
    strings.push(match[1] ?? match[2] ?? '')
  }
  // el(...), ['LABEL'] — a string child is rendered text
  for (const match of withoutComments.matchAll(/\[\s*(?:'([^']*)'|`([^`]*)`)\s*[,\]]/g)) {
    strings.push(match[1] ?? match[2] ?? '')
  }
  return strings.join('\n')
}

const files = uiSources().map((path) => ({
  path,
  copy: visibleCopy(readFileSync(root + path, 'utf8')),
}))

test('there is copy to check', () => {
  assert.ok(files.length >= 6, `only found ${files.length} screen modules`)
  const total = files.reduce((sum, f) => sum + f.copy.length, 0)
  assert.ok(total > 800, `only extracted ${total} characters of copy — is the extractor working?`)
  // The extractor must be finding real sentences, not just button labels.
  assert.ok(files.some((f) => /still available/i.test(f.copy)),
    'expected the rollover copy to be extracted')
})

test('REQUIRED: nothing renders outstanding work as overdue, late, missed or failed', () => {
  // docs/10: outstanding is outstanding. Nothing turns red, nothing is late,
  // nothing accrues a penalty.
  const forbidden = [
    /\boverdue\b/i, /\blate\b/i, /\bmissed\b/i, /\bmissing\b/i, /\bfailed\b/i,
    /\bfailure\b/i, /\bbehind\b/i, /\bskipped\b/i, /\bincomplete\b/i,
    /\bexpired\b/i, /\bpenalt/i, /\bdebt\b/i, /\bowe\b/i,
  ]
  const offenders = []
  for (const { path, copy } of files) {
    for (const pattern of forbidden) {
      const hit = copy.match(pattern)
      if (hit) offenders.push(`${path}: "${hit[0]}"`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('REQUIRED: no streak-shaming or punishment language anywhere', () => {
  // CLAUDE.md non-negotiable 9.
  const forbidden = [
    /streak lost/i, /\bcrushed\b/i, /beast mode/i, /no excuses/i,
    /\bdon't break\b/i, /\bkeep the streak\b/i, /\bslacking\b/i, /\blazy\b/i,
  ]
  const offenders = []
  for (const { path, copy } of files) {
    for (const pattern of forbidden) {
      const hit = copy.match(pattern)
      if (hit) offenders.push(`${path}: "${hit[0]}"`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('no red state is attached to an outstanding task', () => {
  const css = readFileSync(root + 'src/style.css', 'utf8')
  // The bad/vitality red may exist, but never on a task that is merely not done.
  const outstandingRules = css.match(/\.task(?!__)[^{]*\{[^}]*\}/g) ?? []
  for (const rule of outstandingRules) {
    if (/data-done='true'/.test(rule)) continue
    assert.ok(!/--bad|--vitality/.test(rule), `an outstanding task is coloured as a problem:\n${rule}`)
  }
})

test('rest is framed as part of the process, never as absence', () => {
  const all = files.map((f) => f.copy).join('\n')
  if (/\brest day\b/i.test(all) || /\bdeload\b/i.test(all)) {
    assert.ok(!/\brest.{0,20}(instead of|rather than) training\b/i.test(all))
  }
  // The deload copy exists and frames the week as recovery, not as a gap.
  const session = readFileSync(root + 'src/ui/screens/session.js', 'utf8')
  assert.match(session, /recovery/i)
})
