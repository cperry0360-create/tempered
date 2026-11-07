import { nutritionLedger, NUTRIENTS } from './nutrition.js'

export function shiftFuelDate(date, offset) {
  let [year,month,day]=date.split('-').map(Number)
  const monthDays=()=>[31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][month-1]
  for(let remaining=Math.abs(offset);remaining>0;remaining--) {
    day+=Math.sign(offset)
    if(day<1){if(--month<1){month=12;year--}day=monthDays()}
    if(day>monthDays()){day=1;if(++month>12){month=1;year++}}
  }
  return [year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-')
}
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0

/** Read-only calendar window. Missing days and missing nutrients are never zero. */
export function fuelAverage(days,end,{closedOnly=true}={}) {
  const start=shiftFuelDate(end,-6)
  const rows=Array.from({length:7},(_,i)=>{
    const date=shiftFuelDate(start,i),day=days.find(row=>row.date===date)??{date}
    const ledger=nutritionLedger(day)
    const observations=Object.fromEntries(NUTRIENTS.map(({key,entryField,dayField})=>{
      const sources=[ledger.carryover,...ledger.entries]
      const observed=numeric(day[dayField])||sources.some(row=>numeric(row[entryField]))
      return [key,observed?(numeric(day[dayField])?Number(day[dayField]):ledger.totals[key]):null]
    }))
    const recorded=observations.calories!==null
    return {date,day,ledger,observations,recorded,closed:day.nutritionStatus==='complete'}
  })
  const recorded=rows.filter(row=>row.recorded),closed=recorded.filter(row=>row.closed)
  const included=closedOnly?closed:recorded
  const counts={},averages={}
  for(const {key} of NUTRIENTS) {
    const values=included.map(row=>row.observations[key]).filter(value=>value!==null)
    counts[key]=values.length
    averages[key]=values.length?values.reduce((a,b)=>a+b,0)/values.length:null
  }
  // Preserve real itemized meals, divided by the SAME calorie-day denominator.
  const divisor=included.length||1
  const entries=included.flatMap(row=>row.ledger.entries.map(entry=>({...entry,calories:(Number(entry.calories)||0)/divisor})))
  return {start,end,rows,recorded:recorded.length,closed:closed.length,included:included.length,
    averages,counts,day:{calories:averages.calories,proteinGrams:averages.protein,
      nutritionLedgerVersion:1,nutritionEntries:entries,nutritionCarryover:{
        carbsGrams:averages.carbs??0,fatGrams:averages.fat??0,fiberGrams:averages.fiber??0,
      }}}
}
