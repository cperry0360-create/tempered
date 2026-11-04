import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createDailyService } from '../src/app/daily.js'
import { applyActivity, activityValue, isLogged } from '../src/domain/activities.js'
import { dailyHabitProgress } from '../src/ui/screens/today.js'
import { defaultSchedule } from '../src/ui/screens/setup.js'
import { vitalityAwards } from '../src/domain/vitality.js'

const catalogue = JSON.parse(readFileSync(new URL('../data/activities.json',import.meta.url),'utf8'))
const balance = JSON.parse(readFileSync(new URL('../data/balance.json',import.meta.url),'utf8'))
const supplements = catalogue.activities.filter(row=>['creatine','other_supplements'].includes(row.id))

test('two separate daily supplement habits exist with distinct stable IDs and marked semantics',()=>{
  assert.deepEqual(supplements.map(row=>row.id),['creatine','other_supplements'])
  assert.ok(supplements.every(row=>row.daily===true&&row.kind==='marked'))
  assert.equal(supplements[0].name,'Creatine')
  assert.equal(supplements[1].name,'Other supplements')
  const day={date:'2026-11-04',sleepHours:8}
  const creatine=applyActivity(day,'creatine')
  assert.equal(creatine.creatineTaken,true)
  assert.equal(creatine.otherSupplementsTaken,undefined)
  assert.equal(day.creatineTaken,undefined)
  assert.equal(isLogged(supplements[0],creatine),true)
  assert.equal(isLogged(supplements[1],creatine),false)
  assert.equal(activityValue(supplements[0],creatine),true)
  const both=applyActivity(creatine,'other_supplements')
  assert.equal(both.creatineTaken,true)
  assert.equal(both.otherSupplementsTaken,true)
  assert.deepEqual(vitalityAwards(both,balance).filter(a=>/creatine|supplement/i.test(a.source)),[])
})

test('existing profile gets both reminders daily without rewriting its older settings',async()=>{
  const storage=createMemoryStorage()
  await storage.open()
  const before={
    id:'profile',setupComplete:true,dailyActivityIds:['sleep','water'],
    activitySchedule:{ sleep:{cadence:'off',target:1},water:{cadence:'weekly',target:3} },
  }
  await storage.put('profile',before)
  const daily=createDailyService({
    storage,clock:fixedClock(new Date(2026,10,4,12,0,0)),balance,catalogue,
  })
  const schedule=await daily.activitySchedule()
  assert.equal(schedule.creatine.cadence,'daily')
  assert.equal(schedule.other_supplements.cadence,'daily')
  assert.equal(schedule.sleep.cadence,'off')
  assert.equal(schedule.water.cadence,'weekly')
  assert.deepEqual(await storage.get('profile','profile'),before)
  const setup=defaultSchedule(catalogue.activities,before)
  assert.equal(setup.creatine.cadence,'daily')
  assert.equal(setup.other_supplements.cadence,'daily')
  assert.equal(setup.sleep.cadence,'off')
  assert.equal(setup.water.cadence,'weekly')

  const original=await daily.forDate('2026-11-04')
  assert.equal(original.outstanding.find(x=>x.id==='creatine')?.cadence,'daily')
  assert.equal(original.outstanding.find(x=>x.id==='other_supplements')?.cadence,'daily')
  const one=await daily.logAt('2026-11-04','creatine')
  assert.equal(one.day.creatineTaken,true)
  assert.equal(one.day.otherSupplementsTaken,undefined)
  assert.deepEqual(one.awards,[])
  let snapshot=await daily.forDate('2026-11-04')
  assert.equal(snapshot.logged.some(x=>x.id==='creatine'),true)
  assert.equal(snapshot.outstanding.some(x=>x.id==='other_supplements'),true)
  const two=await daily.logAt('2026-11-04','other_supplements')
  assert.equal(two.day.creatineTaken,true)
  assert.equal(two.day.otherSupplementsTaken,true)
  snapshot=await daily.forDate('2026-11-04')
  assert.equal(snapshot.logged.some(x=>x.id==='other_supplements'),true)
  assert.equal(dailyHabitProgress([...snapshot.outstanding,...snapshot.logged]).done>=2,true)
  assert.equal((await storage.get('dayLogs','2026-11-03'))?.creatineTaken,undefined)
  // An explicit opt-out is authoritative and must survive next startup.
  await daily.setCadence('creatine','off')
  const after=await daily.activitySchedule()
  assert.equal(after.creatine.cadence,'off')
  assert.equal(after.other_supplements.cadence,'daily')
  assert.equal(defaultSchedule(catalogue.activities,await storage.get('profile','profile')).creatine.cadence,'off')
  const again=createDailyService({storage,clock:fixedClock(new Date(2026,10,4,12)),balance,catalogue})
  assert.equal((await again.activitySchedule()).creatine.cadence,'off')
  assert.equal((await again.dayLog('2026-11-04')).otherSupplementsTaken,true)
})

test('supplement checkmarks do not automatically fill yesterday, invent doses, or award vitality XP',async()=>{
  const storage=createMemoryStorage();await storage.open()
  const daily=createDailyService({storage,clock:fixedClock(new Date(2026,10,4,12)),balance,catalogue})
  await daily.logAt('2026-11-04','creatine')
  const yesterday=await daily.forDate('2026-11-03')
  assert.equal(yesterday.outstanding.find(x=>x.id==='creatine').logged,false)
  assert.equal(yesterday.outstanding.find(x=>x.id==='other_supplements').logged,false)
  assert.equal((await daily.dayLog('2026-11-04')).creatineTaken,true)
  assert.equal((await daily.dayLog('2026-11-04')).creatineDose,undefined)
})
