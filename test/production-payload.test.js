import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('retired RPG features are lazy and absent from the startup payload', () => {
  const main = read('src/main.js')
  const bootstrap = read('src/app/bootstrap.js')
  const app = read('src/ui/app.js')
  const index = read('index.html')
  const sw = read('sw.js')

  assert.doesNotMatch(main, /^import .*battle/m)
  assert.doesNotMatch(bootstrap, /^import .*\/(?:character|battle)\.js/m)
  assert.match(bootstrap, /import\('\.\/character\.js'\)/)
  assert.match(bootstrap, /import\('\.\/battle\.js'\)/)
  assert.doesNotMatch(app, /^import .*screens\/(?:character|battle)\.js/m)
  assert.match(app, /import\('\.\/screens\/character\.js'\)/)
  assert.match(app, /import\('\.\/screens\/battle\.js'\)/)
  assert.match(app, /const LEGACY_STYLES = \['battle\.css', 'expedition\.css', 'battle-fidelity\.css', 'character\.css'\]/)
  assert.doesNotMatch(index, /battle\.css|expedition\.css|battle-fidelity\.css|character\.css/)
  assert.doesNotMatch(sw, /art\/battle|data\/(?:titles|enemies|items)\.json/)
})

test('nutrition inputs cannot overflow their responsive grid cells', () => {
  const css = read('src/nutrition-today.css')
  assert.match(css, /\.nutrition-meal-field input\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/)
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.nutrition-meal-field--time\s*\{\s*grid-column:\s*1 \/ -1;/)
})
