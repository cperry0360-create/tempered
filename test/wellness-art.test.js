import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const screenFiles = [
  'src/ui/app.js', 'src/ui/screens/today.js', 'src/ui/screens/train.js',
  'src/ui/screens/fuel.js', 'src/ui/screens/history.js', 'src/ui/screens/settings.js',
  'src/ui/screens/setup.js', 'src/ui/screens/summary.js', 'src/ui/calorie-ai-runtime.js',
]

test('active tracker screens use raster images only for workout exercise photos', async () => {
  const sources = await Promise.all(screenFiles.map((path) => readFile(new URL(path, root), 'utf8')))
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /<img|art\/tempered\//, `${screenFiles[index]} adds a decorative image`)
  }
  const session = await readFile(new URL('src/ui/screens/session.js', root), 'utf8')
  assert.match(session, /img\.exercise__thumb/)
  assert.match(session, /img\.exercise__full/)
  assert.match(session, /artUrl\(entry\.exercise\.art\)/)

  const exerciseArt = (await readdir(new URL('art/exercises/', root)))
    .filter((name) => /\.(?:png|jpe?g|webp|avif)$/i.test(name))
  assert.ok(exerciseArt.length > 0, 'workout exercise photos must remain available')
  const worker = await readFile(new URL('sw.js', root), 'utf8')
  for (const name of exerciseArt) assert.ok(worker.includes(`art/exercises/${name}`), `${name} is not cached offline`)
})

test('the shell and offline cache no longer ship decorative product art', async () => {
  const [index, worker] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('sw.js', root), 'utf8'),
  ])
  assert.doesNotMatch(`${index}\n${worker}`, /art\/tempered\/|src\/companion\.css/)
  await assert.rejects(access(new URL('art/tempered/', root)))
})
