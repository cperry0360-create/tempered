import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

async function exists(path) {
  try {
    await access(new URL(path, root))
    return true
  } catch {
    return false
  }
}

test('installed PWA checks for updates without trusting the HTTP cache', async () => {
  const registration = await read('src/pwa/register.js')
  assert.match(registration, /updateViaCache:\s*['"]none['"]/, 'worker update must bypass stale HTTP cache')
  assert.match(registration, /registration\.update\(\)/, 'every app launch explicitly checks for a worker update')
})

test('service worker hands a release over atomically instead of mixing asset generations', async () => {
  const worker = await read('sw.js')
  assert.match(worker, /oldTemperedCaches\.length\s*>\s*0/, 'worker detects replacement of an older Tempered cache')
  assert.match(worker, /client\.navigate\(client\.url\)/, 'open app windows restart after a version handoff')
  assert.match(worker, /event\.respondWith\(\s*network\.catch/s, 'online asset requests are network-first')
  assert.doesNotMatch(
    worker,
    /caches\.match\(request\)\.then\(\(cached\)\s*=>\s*cached\s*\?\?\s*network/,
    'cache-first stale-while-revalidate must not return for app assets',
  )
})

test('the rejected sunset trial is fully removed from the shipped app', async () => {
  const [index, worker] = await Promise.all([read('index.html'), read('sw.js')])
  assert.doesNotMatch(index, /sunset-test|bg-sunset-user/, 'index must not load the sunset trial')
  assert.doesNotMatch(worker, /sunset-test|bg-sunset-user/, 'offline cache must not retain the sunset trial')
  assert.equal(await exists('src/sunset-test.css'), false, 'sunset stylesheet is deleted')
  assert.equal(await exists('art/dist/bg-sunset-user.jpg'), false, 'sunset photo copy is deleted')
})

test('the production bootstrap really installs the daily Workout enhancer', async () => {
  const bootstrap = await read('src/app/bootstrap.js')
  assert.match(bootstrap, /import \{ installDailyWorkoutEnhancer \}/)
  assert.match(bootstrap, /installDailyWorkoutEnhancer\(\{ mount, workout, app, clock \}\)/)
})
