import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

const backgrounds = [
  'bg-wellness.webp', 'bg-today.webp', 'bg-train.webp', 'bg-progress.webp',
  'habitat-starter.webp', 'habitat-mid.webp', 'habitat-full.webp',
  'habitat-forge-starter.webp', 'habitat-forge-mid.webp', 'habitat-forge-full.webp',
]
const transparent = [
  'companion-stage-1.png', 'companion-stage-2.png', 'companion-stage-3.png',
  'companion-stage-4.png', 'companion-stage-5.png', 'companion-forge-stages.png', 'icon-companion.png',
  'icon-progress.png', 'icon-nutrition-ai.png',
]

async function file(path) {
  return readFile(new URL(`art/tempered/${path}`, root))
}

test('the approved wellness art required by visible screens exists', async () => {
  await Promise.all([...backgrounds, ...transparent].map((name) =>
    access(new URL(`art/tempered/${name}`, root))))
})

test('production companion and icon PNGs carry a real alpha channel', async () => {
  for (const name of transparent) {
    const bytes = await file(name)
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${name} is not a PNG`)
    assert.equal(bytes[25], 6, `${name} must use RGBA color type, not a baked checkerboard`)
  }
})

test('every visible wellness asset is available to the installed PWA offline', async () => {
  const worker = await readFile(new URL('sw.js', root), 'utf8')
  for (const name of [...backgrounds, ...transparent]) {
    assert.match(worker, new RegExp(`art/tempered/${name.replaceAll('.', '\\.')}`), `${name} is not precached`)
  }
})

test('runtime styles never point at checkerboard source references', async () => {
  const [pivot, companion] = await Promise.all([
    readFile(new URL('src/pivot.css', root), 'utf8'),
    readFile(new URL('src/companion.css', root), 'utf8'),
  ])
  assert.doesNotMatch(`${pivot}\n${companion}`, /source\/tempered-generated|checkerboard/i)
})
