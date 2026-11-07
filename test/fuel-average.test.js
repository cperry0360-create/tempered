import test from 'node:test'
import assert from 'node:assert/strict'
import { fuelAverage, shiftFuelDate } from '../src/domain/fuel-average.js'

test('calendar average excludes missing days, partial logs, today, and missing nutrients',()=>{
  const rows=[
    {date:'2026-10-31',calories:2800,proteinGrams:140,nutritionStatus:'complete'},
    {date:'2026-11-01',calories:2000,proteinGrams:180,carbsGrams:100,nutritionStatus:'complete'},
    {date:'2026-11-02',calories:300,proteinGrams:30,nutritionStatus:'partial'},
    {date:'2026-11-03',waterOz:120},
    {date:'2026-11-07',calories:150,proteinGrams:30},
  ]
  const before=JSON.stringify(rows),s=fuelAverage(rows,'2026-11-06')
  assert.equal(s.start,'2026-10-31')
  assert.equal(s.closed,2)
  assert.equal(s.recorded,3)
  assert.equal(s.averages.calories,2400)
  assert.equal(s.averages.protein,160)
  assert.equal(s.averages.carbs,100)
  assert.equal(s.counts.carbs,1)
  assert.equal(s.averages.fiber,null)
  assert.equal(fuelAverage(rows,'2026-11-06',{closedOnly:false}).averages.calories,1700)
  assert.equal(JSON.stringify(rows),before)
})
test('empty and earlier calendar windows stay unknown; date offsets cross years',()=>{
  assert.equal(fuelAverage([],'2026-11-06').averages.calories,null)
  assert.equal(fuelAverage([],'2026-11-06').rows.length,7)
  assert.equal(shiftFuelDate('2027-01-01',-1),'2026-12-31')
})
