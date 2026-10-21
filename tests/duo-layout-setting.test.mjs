import test from 'node:test'
import assert from 'node:assert/strict'
import { getDuoLayoutEnabled, setDuoLayoutEnabled } from '../src/ui/duo-layout.js'

function fixture({ saved = null, query = '' } = {}) {
  const items = new Map()
  if (saved !== null) items.set('tempered:duo-layout', saved)
  const storageRef = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  }
  const dataset = {}
  const documentRef = { documentElement: { dataset, removeAttribute: (name) => {
    if (name === 'data-layout') delete dataset.layout
  } } }
  const locationRef = { search: query }
  return { storageRef, locationRef, documentRef, dataset }
}

test('the ordinary installation remains standard by default', () => {
  const f = fixture()
  assert.equal(getDuoLayoutEnabled(f), false)
})

test('the special Duo installation defaults on but a saved setting wins', () => {
  assert.equal(getDuoLayoutEnabled(fixture({ query: '?layout=duo' })), true)
  assert.equal(getDuoLayoutEnabled(fixture({ saved: 'disabled', query: '?layout=duo' })), false)
  assert.equal(getDuoLayoutEnabled(fixture({ saved: 'enabled' })), true)
})

test('the setting turns on and off, and survives another read', () => {
  const f = fixture()
  setDuoLayoutEnabled(true, f)
  assert.equal(f.dataset.layout, 'duo')
  assert.equal(getDuoLayoutEnabled(f), true)
  setDuoLayoutEnabled(false, f)
  assert.equal('layout' in f.dataset, false)
  assert.equal(getDuoLayoutEnabled(f), false)
})

test('failed storage does not prevent changing the current layout', () => {
  const f = fixture()
  const storageRef = { getItem: () => { throw Error('denied') }, setItem: () => { throw Error('denied') } }
  assert.equal(getDuoLayoutEnabled({ ...f, storageRef }), false)
  assert.equal(setDuoLayoutEnabled(true, { ...f, storageRef }), false)
  assert.equal(f.dataset.layout, 'duo')
})

test('the persisted preference is read synchronously before the first paint', () => {
  const html = await (await import('node:fs/promises')).readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /getItem\('tempered:duo-layout'\)/)
  assert.match(html, /saved === 'enabled'/)
  assert.match(html, /saved === 'disabled'/)
  assert.match(html, /dataset\.layout = 'duo'/)
})

test('a visible accessible checkbox controls the experimental layout', async () => {
  const { readFile } = await import('node:fs/promises')
  const settings = await readFile(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8')
  assert.match(settings, /duo-layout-setting__toggle/)
  assert.match(settings, /type: 'checkbox'/)
  assert.match(settings, /setDuoLayoutEnabled/)
  assert.match(settings, /getDuoLayoutEnabled/)
})
