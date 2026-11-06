import test from 'node:test'
import assert from 'node:assert/strict'
import { renderProgressIntelligenceHTML } from '../src/app/progress-intelligence-html.js'

test('private progress HTML is self-contained, compact, read-only and escapes stored labels',()=>{
  const report={
    today:'2026-11-06',targets:{calories:2100,proteinGrams:160,weightLb:160},
    coverage:{firstTrackedDate:'2026-09-05',totalStoredDayRows:42,totalCompletedSessions:55,totalStoredSets:789,lastWeight:{weightLb:166.8}},
    activeProgram:{name:'Beach Cut <script>alert(1)</script>'},
    periods:{7:{weight:{sampleDays:7,average:166.84},calories:{sampleDays:7,closedDays:6,averageClosed:2196},training:{sessions:5,workingSets:61}},30:{weight:{sampleDays:18,average:167.61,linearTrendLbPerWeek:-0.553},calories:{sampleDays:9,closedDays:8,averageClosed:2159.81},training:{sessions:23,workingSets:382}}},
    priorPeriods:{},habits:[{id:'creatine',name:'Creatine',cadence:'daily',windows:{7:{eligibleDays:3,markedDays:3,markedPercent:100}}}],
    lifts:[{name:'Row',method:'Dumbbell',status:'improving',changePercent:5.64,lastDate:'2026-11-03',exposures:7,bestSessionHistory:[{date:'2026-11-03',workingSets:2,bestSet:{loadLb:58.5,reps:9}}]}],
    dailyHistory:[{date:'2026-11-06',bodyMetrics:{weight:166.8}}],
    trainingScore:{latestGradedWeek:{score:58,grade:'Rebuild week',components:[{label:'Progression',scorePercent:59,weightPercent:35,reason:'10 of 20 lifts up'}]},currentWeek:{graded:false,done:40,due:63,status:'still to do'},skippedWeeks:[]},
  }
  const html=renderProgressIntelligenceHTML(report)
  assert.match(html,/<!doctype html>/i)
  assert.match(html,/Progress Intelligence/)
  assert.match(html,/data-page="strength"/)
  assert.match(html,/data-page="nutrition"/)
  assert.match(html,/data-page="habits"/)
  assert.match(html,/data-page="evidence"/)
  assert.match(html,/Print \/ PDF/)
  assert.match(html,/2,160/)
  assert.match(html,/−|-/)
  assert.match(html,/58/)
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(html,/https?:\/\//)
  assert.doesNotMatch(html,/fetch\(/)
  assert.doesNotMatch(html,/localStorage\.|indexedDB\./)
})