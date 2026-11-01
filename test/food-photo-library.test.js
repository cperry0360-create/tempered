import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { FOOD_PHOTOS, matchingFoodPhoto } from '../src/ui/food-photos.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root))
const catalog = JSON.parse(read('art/food/catalog.json'))
const source = JSON.parse(read('art/food/SOURCES.json'))
const sw = read('sw.js').toString()

test('every bundled food photo has a verified CC0 licence and a matching locally stored file', () => {
  assert.equal(FOOD_PHOTOS.length, 16)
  assert.equal(catalog.images.length, source.entries.length)
  const ids = new Set()
  for (const meta of catalog.images) {
    assert.equal(ids.has(meta.id), false, 'duplicate photo id '+meta.id)
    ids.add(meta.id)
    assert.match(meta.license, /^(CC0|PUBLIC DOMAIN)/)
    assert.match(meta.sourcePage, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    assert.match(meta.licenseUrl, /^https?:\/\/creativecommons\.org\/publicdomain/)
    assert.ok(meta.author)
    const p = new URL('art/food/'+meta.id+'.jpg', root)
    assert.ok(existsSync(p),'missing local image '+meta.id)
    const bytes = readFileSync(p)
    assert.ok(bytes.length>3000 && bytes.length<200000,meta.id+' must be optimized thumbnail')
    assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256)
    assert.match(sw,new RegExp("'\\./art/food/"+meta.id+"\\.jpg'"),'asset must precache '+meta.id)
  }
  assert.ok(ids.size>=12)
})

test('food photo lookup is category-based and never matches unrelated foods', () => {
  assert.equal(matchingFoodPhoto('Greek yogurt with fresh berries')?.id, 'yogurt-berries')
  assert.equal(matchingFoodPhoto('Chicken and rice bowl')?.id, 'chicken')
  assert.equal(matchingFoodPhoto('Plain greek yogurt')?.id, 'yogurt')
  assert.equal(matchingFoodPhoto('A banana')?.id, 'banana')
  assert.equal(matchingFoodPhoto('Sushi box')?.id, 'sushi')
  assert.equal(matchingFoodPhoto('Chocolate protein shake'), null)
  assert.equal(matchingFoodPhoto('eggplant parmesan'), null)
  assert.equal(matchingFoodPhoto(''), null)
})

test('food photo paths are GitHub Pages-relative and require no live stock-photo service', () => {
  const rootPath = fileURLToPath(root)
  const ids = new Set(catalog.images.map(x=>x.id))
  for(const photo of FOOD_PHOTOS){
    assert.ok(ids.has(photo.id))
    assert.equal(new URL(photo.url).protocol, 'file:')
    assert.ok(fileURLToPath(photo.url).startsWith(rootPath+'art/food/'))
  }
  const ui = read('src/ui/screens/fuel-next.js').toString()
  assert.doesNotMatch(ui, /images\.unsplash\.com|images\.pexels\.com|upload\.wikimedia\.org/)
  assert.match(sw, /'\.\/src\/ui\/food-photos\.js'/)
  assert.match(sw, /'\.\/art\/food\/catalog\.json'/)
})
