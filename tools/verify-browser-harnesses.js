#!/usr/bin/env node
/**
 * Runs every browser acceptance harness and reports the whole picture.
 *
 * Do not stop at the first failure. The point of this runner is to make CI say
 * exactly which product/document contracts drifted, with real check totals for
 * every harness. persistence.html has its own three-process driver; every other
 * HTML harness uses verify-logging-speed.js as the generic browser driver.
 */

import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const pages = readdirSync(new URL('../test/browser/', import.meta.url))
  .filter((name) => name.endsWith('.html') && name !== 'persistence.html')
  .sort()

const summaries = []
let totalChecks = 0
let totalFailed = 0
let failedHarnesses = 0

function run(label, command, args) {
  console.log(`\n===== ${label} =====`)
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)

  const matches = [...output.matchAll(/(\d+) checks, (\d+) failed/g)]
  const checks = matches.reduce((sum, match) => sum + Number(match[1]), 0)
  const failed = matches.reduce((sum, match) => sum + Number(match[2]), 0)
  const ok = result.status === 0

  totalChecks += checks
  totalFailed += failed
  if (!ok) failedHarnesses += 1
  summaries.push({ label, checks, failed, ok, exit: result.status })
}

for (const page of pages) {
  run(page, process.execPath, [
    'tools/verify-logging-speed.js',
    '--page', `test/browser/${page}`,
    '--window', '390,844',
  ])
}

run('persistence.html', process.execPath, ['tools/verify-persistence.js'])

console.log('\n===== BROWSER HARNESS SUMMARY =====')
for (const item of summaries) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.label}: ${item.checks} checks, ${item.failed} failed`)
}
console.log(`TOTAL: ${totalChecks} checks, ${totalFailed} failed across ${summaries.length} harnesses; ${failedHarnesses} harnesses red`)

process.exit(failedHarnesses === 0 ? 0 : 1)
