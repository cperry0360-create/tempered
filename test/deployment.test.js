import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')

test('Pages publishes a curated runtime artifact instead of the repository root', () => {
  assert.match(workflow, /mkdir -p _site\/art/)
  assert.match(workflow, /cp index\.html manifest\.webmanifest sw\.js _site\//)
  assert.match(workflow, /cp -R src data icons _site\//)
  assert.match(workflow, /cp -R art\/tempered art\/exercises art\/dist art\/battle _site\/art\//)
  assert.match(workflow, /path:\s*_site/)
  assert.doesNotMatch(workflow, /cp -R art\s/)
  assert.doesNotMatch(workflow, /path:\s*[.'"]+\s*$/m)
})
