import test from 'node:test'
import assert from 'node:assert/strict'

const shift = (date, days) => new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)
function block({ stalled=false, missed=false, deload=false, extra=false }={}) {
  const today='2026-09-27', start='2026-08-17'
  const program={id:'p',weeks:deload?6:8,days:[0,1].map(i=>({id:'d'+i,exercises:[{exerciseId:'lift',sets:2,repMin:6,repMax:10}]}))}
  const sessions=[],setLogs=[]
  for(let w=0;w<6;w++)for(let d=0;d<2;d++) {
    if(missed&&w===5)continue
    const date=shift(start,w*7+d*2),id=`s${w}${d}`
    sessions.push({id,date,endedAt:date+'T10:00:00Z',durationMinutes:30,programId:'p'})
    for(let n=0;n<(extra&&w===5?4:2);n++)setLogs.push({id:id+n,sessionId:id,exerciseId:'lift',programId:'p',programDayId:'d'+d,slotIndex:0,weight:stalled?100:100+w*5,reps:6})
  }
  return {today,sessions,setLogs,programs:[program],programStates:[{programId:'p',startedOn:start,active:true}]}
}
const run=async input=>(await import('./training-score.js')).trainingScore(input)
test('improving block: weights, caps and twelve-week history',async()=>{
 const result=await run(block({extra:true})),c=result.current.components
 assert.equal(result.current.score,100);assert.equal(result.current.grade,'A')
 assert.ok(c.every((x,i)=>Math.abs(x.weight-[.35,.30,.25,.10][i])<1e-12));assert.ok(c.every(x=>x.value===1))
 assert.equal(result.weeks.length,6);assert.equal(c[1].completed,4);assert.equal(c[1].prescribed,4)
 assert.equal(result.current.soFar,true);assert.ok(c.every(x=>x.reason&&x.details.length))
})
test('stalled block: holding earns 0.6 and weighted total is 86',async()=>{
 const r=await run(block({stalled:true}));assert.equal(r.current.components[0].value,.6)
 assert.equal(r.current.score,86);assert.equal(r.current.grade,'B');assert.equal(r.current.components[0].details[0].status,'held')
})
test('deload week: skip progression and volume, reweight 30:25',async()=>{
 const r=await run(block({deload:true})),c=r.current.components
 assert.equal(r.current.deload,true);assert.equal(c[0].value,null);assert.equal(c[3].value,null)
 assert.equal(c[1].weight,30/55);assert.equal(c[2].weight,25/55);assert.equal(r.current.score,100)
})
test('missed week: canonical zero work, no F and no invented days',async()=>{
 const r=await run(block({missed:true})),c=r.current.components
 assert.equal(c[1].value,0);assert.equal(c[2].days,0);assert.ok(Math.abs(c[2].value-.225)<1e-12)
 assert.equal(c[3].value,0);assert.equal(r.current.grade,'Rebuild week');assert.equal(r.weeks.length,6)
})
test('brand-new user: no pre-tracking weeks and no history penalty',async()=>{
 const r=await run({today:'2026-09-27',sessions:[],setLogs:[],programs:[],programStates:[]})
 assert.equal(r.current.score,null);assert.equal(r.current.grade,null);assert.deepEqual(r.weeks,[])
 const first=block();first.sessions=first.sessions.filter(s=>s.date==='2026-09-23');first.setLogs=first.setLogs.filter(s=>first.sessions.some(t=>t.id===s.sessionId));first.programStates[0].startedOn='2026-09-21'
 const n=await run(first);assert.equal(n.weeks.length,1);assert.equal(n.current.components[0].value,null);assert.equal(n.current.components[3].value,null)
 assert.equal(n.current.components[1].weight,30/55);assert.equal(n.current.components[2].weight,25/55)
})

test('rep minimum and completion use same-week slot identity, not day of session',async()=>{
 const input=block({stalled:true})
 const current=input.sessions.filter(s=>s.date>='2026-09-21')
 current.forEach(s=>s.date='2026-09-27') // Both planned days finished as Sunday leftovers.
 const currentIds=new Set(current.map(s=>s.id))
 input.setLogs.filter(s=>currentIds.has(s.sessionId)).forEach((s,i)=>s.reps=i%2?5:6)
 input.setLogs.push({id:'warmup',sessionId:current[0].id,exerciseId:'lift',isWarmup:true,programId:'p',programDayId:'d0',slotIndex:0,weight:999,reps:99})
 const c=(await run(input)).current.components
 assert.equal(c[1].completed,4);assert.equal(c[1].value,.85);assert.equal(c[1].reached,2)
 assert.equal(c[2].days,1);assert.equal(c[3].sets,4);assert.equal(c[0].value,.6)
})
test('volume below 95% scales, and unplanned sets cannot complete a planned slot',async()=>{
 const input=block();const ids=new Set(input.sessions.filter(s=>s.date>='2026-09-21').map(s=>s.id))
 input.setLogs=input.setLogs.filter(s=>!ids.has(s.sessionId)||s.id.endsWith('0'))
 input.setLogs.filter(s=>ids.has(s.sessionId)).forEach(s=>s.programDayId='other')
 const c=(await run(input)).current.components
 assert.equal(c[1].completed,0);assert.equal(c[3].value,2/(4*.95))
})
test('same-load rep improvements and one-percent holding are distinguished from drops',async()=>{
 const input=block({stalled:true});const ids=new Set(input.sessions.filter(s=>s.date>='2026-09-14').map(s=>s.id))
 input.setLogs.filter(s=>ids.has(s.sessionId)).forEach(s=>s.reps=7)
 assert.equal((await run(input)).current.components[0].details[0].status,'up')
 input.setLogs.filter(s=>ids.has(s.sessionId)).forEach(s=>{s.reps=6;s.weight=99.5})
 assert.equal((await run(input)).current.components[0].details[0].status,'held')
 input.setLogs.filter(s=>ids.has(s.sessionId)).forEach(s=>s.weight=90)
 assert.equal((await run(input)).current.components[0].details[0].status,'down')
})
test('incomplete, future, and method-mixed histories do not invent progression',async()=>{
 const input=block();input.sessions.filter(s=>s.date<'2026-09-14').forEach(s=>s.endedAt=null)
 assert.equal((await run(input)).current.components[0].value,null)
 const mixed=block();mixed.setLogs.filter(s=>s.sessionId.startsWith('s4')||s.sessionId.startsWith('s5')).forEach(s=>s.method='cable')
 assert.equal((await run(mixed)).current.components[0].value,null)
 const future=block();future.sessions.push({id:'future',date:'2026-09-28',endedAt:'yes',durationMinutes:999});future.setLogs.push({id:'f',sessionId:'future',exerciseId:'lift',weight:999,reps:99})
 assert.deepEqual(await run(future),await run(block()))
})
test('immutable week revision preserves adherence after later plan edits',async()=>{
 const input=block();const original=structuredClone(input.programs[0]);input.programs[0].days[0].exercises[0].sets=100
 input.revisions=[{id:'old',programId:'p',snapshot:original}]
 input.sessions.forEach(s=>s.programRevisionId='old')
 assert.equal((await run(input)).current.components[1].prescribed,4)
})
test('same-day program switch uses the active plan, not insertion order',async()=>{
 const input=block();input.programs.unshift({id:'old',weeks:8,days:[{id:'other',exercises:[{exerciseId:'lift',sets:99,repMin:6}]}]})
 input.programStates.unshift({programId:'old',startedOn:'2026-08-17',active:false})
 assert.equal((await run(input)).current.components[1].prescribed,4)
})
