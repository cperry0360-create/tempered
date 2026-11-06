/** Read-only LFMS longitudinal data export. No writes, photos or identity fields. */
import { ACTIVITY_FIELDS } from './activities.js'
import { effectiveLoad } from './records.js'
import { estimateOneRepMax } from './e1rm.js'
export { formatProgressIntelligencePrompt } from './progress-intelligence-prompt.js'
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null
const round=(v,p=1)=>numeric(v)===null?null:Math.round(v*10**p)/10**p
const avg=values=>{const x=values.filter(v=>numeric(v)!==null);return x.length?round(x.reduce((s,v)=>s+v,0)/x.length,2):null}
const dayMs=date=>Date.parse(date+'T12:00:00Z')
const shift=(date,n)=>new Date(dayMs(date)+n*86400000).toISOString().slice(0,10)
const span=(a,b)=>Math.round((dayMs(b)-dayMs(a))/86400000)
const within=(date,start,end)=>typeof date==='string'&&date>=start&&date<=end
const valid=/^\d{4}-\d{2}-\d{2}$/
const fields=(source,keys)=>Object.fromEntries(keys.map(key=>[key,numeric(source?.[key])]).filter(([,v])=>v!==null))
const nutritionKeys=['calories','proteinGrams','carbsGrams','fatGrams','fiberGrams']
const dayNumbers=[...nutritionKeys,'waterOz','steps','sleepHours','microCardioMinutes','mobilityMinutes','waistInches']
const bodyKeys=['weight','bodyFat','bodyFatPercent','bodyFatPercentage','muscleMass','leanMass']
const sizeKeys=['waist','chest','hips','arm','thigh','neck','shoulders','calf']
const healthKeys=['restingHr','hrvMs','respiratoryRate','spo2','vo2Max','heartRate']
const markKeys=['creatineTaken','otherSupplementsTaken','alcoholFree','restDay','saunaLogged','journalLogged']
const observedCalories=day=>numeric(day.calories)!==null&&(day.caloriesLogged===true||
  day.nutritionLogged===true||day.nutritionStatus==='complete'||(day.nutritionEntries?.length??0)>0)
const observedProtein=day=>numeric(day.proteinGrams)!==null&&(day.nutritionLogged===true||
  day.caloriesLogged===true||day.nutritionStatus==='complete'||(day.nutritionEntries?.length??0)>0)
function compactDay(day){
  const r={date:day.date,...fields(day,dayNumbers)}
  if(day.nutritionStatus)r.nutritionStatus=day.nutritionStatus
  if(observedCalories(day))r.caloriesRecorded=true
  if(observedProtein(day))r.proteinRecorded=true
  for(const key of markKeys)if(day[key]===true)r[key]=true
  for(const [name,source,keys] of [['bodyMetrics',day.bodyMetrics,bodyKeys],
    ['bodyMeasurements',day.bodyMeasurements,sizeKeys],['healthMetrics',day.healthMetrics,healthKeys]]){
    const values=fields(source,keys)
    if(Object.keys(values).length)r[name]=values
  }
  if(Array.isArray(day.nutritionEntries)&&day.nutritionEntries.length){
    r.meals=day.nutritionEntries.filter(x=>x&&typeof x==='object').map(m=>({
      ...fields(m,[...nutritionKeys,'portion']),
      ...(m.description?{description:String(m.description).slice(0,140)}:{}),
      ...(m.loggedAt?{loggedAt:m.loggedAt}:{}),
    }))
  }
  if(day.nutritionCarryover)r.legacyNutritionCarryover=fields(day.nutritionCarryover,nutritionKeys)
  return r
}
function weightTrend(points){
  if(points.length<4||span(points[0].date,points.at(-1).date)<14)return null
  const nums=points.map(p=>[span(points[0].date,p.date),p.value])
  const x=avg(nums.map(p=>p[0])),y=avg(nums.map(p=>p[1]))
  const den=nums.reduce((s,p)=>s+(p[0]-x)**2,0)
  if(!den)return null
  return round(nums.reduce((s,p)=>s+(p[0]-x)*(p[1]-y),0)/den*7,3)
}
function makePeriod(end,days,rows,sessions,sets,start,targets){
  const since=shift(end,1-days)
  const recent=rows.filter(d=>within(d.date,since,end))
  const known=start?Math.max(0,Math.min(days,span(Math.max(since,start),end)+1)):0
  const calories=recent.filter(observedCalories),protein=recent.filter(observedProtein)
  const closed=calories.filter(d=>d.nutritionStatus==='complete')
  const weight=recent.filter(d=>numeric(d.bodyMetrics?.weight)!==null&&d.bodyMetrics.weight>0)
    .map(d=>({date:d.date,value:d.bodyMetrics.weight}))
  const pSessions=sessions.filter(s=>within(s.date,since,end))
  const ids=new Set(pSessions.map(s=>s.id))
  const pSets=sets.filter(s=>ids.has(s.sessionId)&&!s.isWarmup&&s.setType!=='warmup')
  const health={}
  for(const key of ['steps','sleepHours','waterOz','microCardioMinutes','restingHr','hrvMs','respiratoryRate','spo2']){
    const nested=['restingHr','hrvMs','respiratoryRate','spo2'].includes(key)
    const samples=recent.map(d=>nested?d.healthMetrics?.[key]:d[key]).filter(v=>numeric(v)!==null)
    health[key]={sampleDays:samples.length,average:avg(samples)}
  }
  return {start:since,end,requestedDays:days,daysSinceTrackingBegan:known,
    daysWithAnySavedLog:recent.length,
    calories:{sampleDays:calories.length,closedDays:closed.length,
      averageLogged:avg(calories.map(d=>d.calories)),averageClosed:avg(closed.map(d=>d.calories)),
      daysAtOrBelowTarget:numeric(targets.calories)!==null
        ?calories.filter(d=>d.calories<=targets.calories).length:null,target:targets.calories},
    protein:{sampleDays:protein.length,averageGrams:avg(protein.map(d=>d.proteinGrams)),
      daysAtTarget:numeric(targets.proteinGrams)!==null
        ?protein.filter(d=>d.proteinGrams>=targets.proteinGrams).length:null,targetGrams:targets.proteinGrams},
    weight:{sampleDays:weight.length,average:avg(weight.map(w=>w.value)),
      first:weight[0]??null,last:weight.at(-1)??null,
      firstToLastDelta:weight.length>=2?round(weight.at(-1).value-weight[0].value,2):null,
      spanDays:weight.length>=2?span(weight[0].date,weight.at(-1).date):0,
      linearTrendLbPerWeek:weightTrend(weight)},
    training:{sessions:pSessions.length,trainingDays:new Set(pSessions.map(s=>s.date)).size,
      workingSets:pSets.length,totalMinutes:round(pSessions.reduce((s,w)=>s+(numeric(w.durationMinutes)??0),0))},
    health}
}
function exerciseTrends(sessions,setLogs,exercises,today){
  const dates=new Map(sessions.map(s=>[s.id,s.date])),groups=new Map()
  for(const log of setLogs){
    const date=dates.get(log.sessionId)
    if(!date||!log.exerciseId||log.isWarmup||log.setType==='warmup')continue
    if(numeric(log.reps)===null||log.reps<=0)continue
    const load=effectiveLoad(log,exercises)
    if(load<=0)continue
    const method=String(log.method??'standard'),id=log.exerciseId
    const key=id+'|'+method,group=groups.get(key)??{
      exerciseId:id,method,name:exercises.get(id)?.name??id,bySession:new Map()}
    const point=group.bySession.get(log.sessionId)??{
      date,sessionId:log.sessionId,workingSets:0,volumeLb:0,peakE1rm:null,bestSet:null}
    point.workingSets++
    point.volumeLb+=load*log.reps
    if(log.reps<=12){
      const estimate=estimateOneRepMax(load,log.reps)
      if(point.peakE1rm===null||estimate>point.peakE1rm){
        point.peakE1rm=estimate;point.bestSet={loadLb:round(load,2),reps:log.reps}
      }
    }
    group.bySession.set(log.sessionId,point);groups.set(key,group)
  }
  return [...groups.values()].map(group=>{
    const series=[...group.bySession.values()].map(p=>({
      ...p,volumeLb:round(p.volumeLb),peakE1rm:round(p.peakE1rm,2)}))
      .sort((a,b)=>a.date.localeCompare(b.date)||String(a.sessionId).localeCompare(String(b.sessionId)))
    const rated=series.filter(p=>numeric(p.peakE1rm)!==null)
    const recent=rated.slice(-3),prior=rated.slice(-6,-3),last=rated.at(-1)
    let status='insufficient evidence',changePercent=null
    if(last&&span(last.date,today)>35)status='not recently trained'
    else if(recent.length===3&&prior.length===3&&span(rated[0].date,last.date)>=21){
      const old=avg(prior.map(p=>p.peakE1rm)),now=avg(recent.map(p=>p.peakE1rm))
      if(old>0){
        changePercent=round((now/old-1)*100,2)
        status=changePercent>2?'improving':changePercent< -2?'declining':'flat candidate'
      }
    }
    return {exerciseId:group.exerciseId,name:group.name,method:group.method,exposures:series.length,
      comparableExposures:rated.length,lastDate:series.at(-1)?.date??null,
      latestBestSet:last?.bestSet??null,latestEstimated1RMLb:last?.peakE1rm??null,
      previousThreeAverageE1RM:prior.length===3?avg(prior.map(p=>p.peakE1rm)):null,
      latestThreeAverageE1RM:recent.length===3?avg(recent.map(p=>p.peakE1rm)):null,
      changePercent,status,bestSessionHistory:series}
  }).sort((a,b)=>(b.lastDate??'').localeCompare(a.lastDate??'')||a.name.localeCompare(b.name))
}
function habitWindows({today,rows,start,schedule,activities}){
  const names=new Map(activities.map(a=>[a.id,a.short??a.name??a.id]))
  const result=[]
  for(const [id,spec] of Object.entries(ACTIVITY_FIELDS)){
    if(spec.entry!=='mark'||(!names.has(id)&&!['creatine','other_supplements'].includes(id)))continue
    const cadence=schedule[id]?.cadence??'unknown'
    const windows={}
    for(const days of [7,14,30,90]){
      const from=[shift(today,1-days),start??today,
        ['creatine','other_supplements'].includes(id)?'2026-11-04':'1900-01-01'].sort().at(-1)
      const eligibleDays=cadence==='daily'&&from<=today?span(from,today)+1:0
      const marked=rows.filter(d=>within(d.date,from,today)&&d[spec.field]===true)
      windows[days]={eligibleDays,markedDays:marked.length,
        markedPercent:eligibleDays?round(marked.length/eligibleDays*100):null,
        latestMarked:marked.at(-1)?.date??null}
    }
    result.push({id,name:names.get(id)??id,cadence,windows,
      note:'A checkoff confirms logging, not proof of intake. Unchecked means not confirmed, not proof of a missed dose.'})
  }
  return result
}
export function buildProgressIntelligence({today,dayLogs=[],sessions=[],setLogs=[],exercises=new Map(),
  programs=[],programStates=[],records=[],schedule={},activities=[],goals={},range=30,awayPeriods=[]}={}){
  if(!valid.test(today??''))throw Error('A local YYYY-MM-DD date is required')
  const rows=dayLogs.filter(d=>valid.test(d?.date??'')&&d.date<=today).sort((a,b)=>a.date.localeCompare(b.date))
  const done=sessions.filter(s=>valid.test(s?.date??'')&&s.date<=today&&(s.endedAt||s.completedAt))
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)))
  const ids=new Set(done.map(s=>s.id)),logs=setLogs.filter(s=>ids.has(s.sessionId))
  const start=[rows[0]?.date,done[0]?.date].filter(Boolean).sort()[0]??null
  const targets={calories:numeric(goals.calories),proteinGrams:numeric(goals.protein),
    weightLb:numeric(goals.weight),weightUnit:'lb'}
  const periods={},priorPeriods={}
  for(const days of [7,14,30,90]){
    periods[days]=makePeriod(today,days,rows,done,logs,start,targets)
    priorPeriods[days]=makePeriod(shift(today,-days),days,rows,done,logs,start,targets)
  }
  const active=programStates.find(p=>p.active),program=programs.find(p=>p.id===active?.programId)
  const weighIns=rows.filter(d=>numeric(d.bodyMetrics?.weight)!==null&&d.bodyMetrics.weight>0)
  const dailyHistory=rows.map(compactDay)
  const trainingHistory=done.map(s=>({
    date:s.date,sessionId:s.id,routine:s.routineName??s.routineId??null,durationMinutes:numeric(s.durationMinutes),
    sets:logs.filter(l=>l.sessionId===s.id).map(l=>({
      exerciseId:l.exerciseId,exercise:exercises.get(l.exerciseId)?.name??l.exerciseId,
      method:l.method??null,loadLb:numeric(l.weight),effectiveLoadLb:round(effectiveLoad(l,exercises),2),
      reps:numeric(l.reps),warmup:!!(l.isWarmup||l.setType==='warmup'),setType:l.setType??null,
    }))
  }))
  return {schema:'LFMS_PROGRESS_INTELLIGENCE_V1',today,selectedUiRangeDays:range,
    definition:'Complete available local daily nutrition/health observations and completed workout sets; photos and unrelated personal fields omitted.',
    coverage:{firstTrackedDate:start,totalStoredDayRows:rows.length,totalCompletedSessions:done.length,
      totalStoredSets:logs.length,firstWeightDate:weighIns[0]?.date??null,
      lastWeight:weighIns.length?{date:weighIns.at(-1).date,weightLb:weighIns.at(-1).bodyMetrics.weight}:null,
      supplementTrackingStartedOn:'2026-11-04'},
    targets,activeProgram:{id:active?.programId??null,name:program?.name??null,
      startedOn:active?.startedOn??active?.startDate??null},
    periods,priorPeriods,habits:habitWindows({today,rows,start,schedule,activities}),
    lifts:exerciseTrends(done,logs,exercises,today),
    historicalPersonalRecords:records.map(r=>({
      exercise:exercises.get(r.exerciseId)?.name??r.exerciseId,bestWeight:r.bestWeight??null,
      bestE1RM:r.bestE1RM??null,bestVolume:r.bestVolume??null})),
    awayPeriods:awayPeriods.filter(p=>valid.test(p.start)&&p.start<=today)
      .map(p=>({start:p.start,end:p.end??p.start})),
    dailyHistory,trainingHistory}
}
