import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressIntelligence, formatProgressIntelligencePrompt } from '../src/app/progress-intelligence.js'
const today='2026-11-06'
const shift=(date,n)=>{
  const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)
}
function fixture(){
  const dayLogs=Array.from({length:35},(_,i)=>{
    const date=shift(today,i-34),weight=168-i*.08
    return {date,calories:1990+i%3*90,caloriesLogged:i%7!==0,
      nutritionStatus:i%7!==0?'complete':'partial',proteinGrams:150+i%3*5,
      bodyMetrics:i%2===0?{weight}:undefined,steps:5000+i*50,sleepHours:7+i%3*.25,
      creatineTaken:date>='2026-11-04'?i!==33:undefined,
      otherSupplementsTaken:date==='2026-11-05',
      waterOz:i%2===0?80:undefined,
      healthMetrics:i%3===0?{restingHr:58+i%4,hrvMs:32+i%6}:undefined}
  })
  const sessions=Array.from({length:6},(_,i)=>({id:'session-'+i,date:shift(today,-48+i*8),endedAt:'x',durationMinutes:55,routineName:'Day A'}))
  const setLogs=sessions.map((s,i)=>({sessionId:s.id,exerciseId:'bench',weight:i<3?100:100.2,reps:8,isWarmup:false,method:'barbell'}))
  return {today,dayLogs,sessions,setLogs,exercises:new Map([['bench',{id:'bench',name:'Bench press'}]]),
    activities:[{id:'creatine',name:'Creatine'},{id:'other_supplements',name:'Other supplements'}],
    schedule:{creatine:{cadence:'daily'},other_supplements:{cadence:'daily'}},
    goals:{calories:2100,protein:160,weight:160},range:30,programs:[],programStates:[],records:[],
    awayPeriods:[]}
}
test('full analysis contains 7/14/30/90-day current and previous periods with real sample coverage',()=>{
  const r=buildProgressIntelligence(fixture())
  assert.equal(r.schema,'LFMS_PROGRESS_INTELLIGENCE_V1')
  for(const days of [7,14,30,90]){
    const p=r.periods[days],prior=r.priorPeriods[days]
    assert.equal(p.requestedDays,days)
    assert.equal(prior.requestedDays,days)
    assert.ok(p.calories.sampleDays <=p.requestedDays)
    assert.ok(p.weight.sampleDays <=p.requestedDays)
    assert.ok(p.calories.averageLogged!==null)
  }
  assert.equal(r.targets.calories,2100)
  assert.equal(r.targets.proteinGrams,160)
  assert.ok(r.dailyHistory.length===35)
})
test('only actually logged calories count; empty days are unknown, never zero',()=>{
  const f=fixture()
  f.dayLogs=[{date:today},{date:shift(today,-1),calories:1200,caloriesLogged:true,nutritionStatus:'complete'},
    {date:shift(today,-2),calories:0,nutritionStatus:'partial'}]
  const r=buildProgressIntelligence(f)
  assert.equal(r.periods[7].calories.sampleDays,1)
  assert.equal(r.periods[7].calories.averageLogged,1200)
  assert.equal(r.periods[7].calories.closedDays,1)
  assert.equal(r.dailyHistory.length,3)
})
test('habit reporting respects launch date and does not describe unmarked days as confirmed missed',()=>{
  const r=buildProgressIntelligence(fixture())
  const creatine=r.habits.find(x=>x.id==='creatine')
  const other=r.habits.find(x=>x.id==='other_supplements')
  assert.equal(creatine.windows[30].eligibleDays,3)
  assert.equal(other.windows[30].eligibleDays,3)
  assert.ok(creatine.windows[30].markedDays<=3)
  assert.equal(other.windows[30].markedDays,1)
  assert.ok(creatine.note.includes('not proof'))
})
test('lift trends use comparable methods and exposures, no unearned plateau claims',()=>{
  const r=buildProgressIntelligence(fixture())
  const bench=r.lifts.find(x=>x.exerciseId==='bench')
  assert.equal(bench.exposures,6)
  assert.equal(bench.name,'Bench press')
  assert.ok(bench.bestSessionHistory.length===6)
  assert.ok(['flat candidate','improving','declining','insufficient evidence','not recently trained'].includes(bench.status))
  const f=fixture();f.setLogs=[{sessionId:'session-0',exerciseId:'bench',weight:100,reps:8,isWarmup:false,method:'barbell'}]
  const sparse=buildProgressIntelligence(f)
  assert.equal(sparse.lifts[0].status,'insufficient evidence')
})
test('all actual historical days are carried in compact data without photos, identities, or fake weights',()=>{
  const f=fixture();f.dayLogs[0].mealPhotos={abc:'verylargephoto'};f.dayLogs[0].nutritionEntries=[{id:'a',description:'Greek yogurt',calories:140,proteinGrams:15}]
  const r=buildProgressIntelligence(f)
  assert.equal(r.dailyHistory[0].meals[0].description,'Greek yogurt')
  assert.doesNotMatch(JSON.stringify(r),/verylargephoto/)
  assert.ok(r.trainingHistory.length===6)
  assert.ok(r.coverage.firstTrackedDate)
})
test('improved prompt asks for evidence-first priorities, calorie decision, strength plateaus, and supplements',()=>{
  const p=formatProgressIntelligencePrompt(buildProgressIntelligence(fixture()))
  for(const word of ['creatine','weight','calorie','plateau','strength','confidence','7','14','30','90'])
    assert.ok(p.toLowerCase().includes(word),word)
  assert.match(p,/do not invent/i)
  assert.match(p,/do not silently/i)
  assert.match(p,/LFMS_PROGRESS_INTELLIGENCE_V1/)
})
