/**
 * LFMS Fuel neon-glass nutrition widget.
 * Visual-only adapter over the canonical day ledger and existing goals.
 * No new storage, fields, or invented meal allocations.
 */
import { nutritionLedger } from '../domain/nutrition.js'
import { el } from './dom.js'

const NS='http://www.w3.org/2000/svg'
const val=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0
const fmt=x=>Math.round(val(x)).toLocaleString()
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x))
const percent=(x,goal)=>goal>0?100*val(x)/goal:0

const symbolPaths={
  flame:['M12 2c.6 4.2-2.3 5.2-2.3 8.5-1.5-1.1-2-3-1.7-4.4C4.1 8.4 3 11.1 3 14.3 3 19.2 7 22 12 22s9-3.5 9-8.2c0-3.8-2.1-7.3-5.6-9.9.7 3.1-.5 5-1.6 6-1.1-1.3-1.2-4.4-1.8-7.9Z'],
  breakfast:['M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z','M12 1.5v3.2M12 19.3v3.2M1.5 12h3.2M19.3 12h3.2M4.55 4.55l2.25 2.25M17.2 17.2l2.25 2.25M19.45 4.55 17.2 6.8M6.8 17.2l-2.25 2.25'],
  lunch:['M3 2v8a3 3 0 0 0 6 0V2M6 2v20M15 2c-3.5 3.8-4 9.8 0 12h3V2M18 14v8'],
  dinner:['M2 17h20M4 15a8 8 0 0 1 16 0M12 5V3M3 20h18'],
  snack:['M12 6.5C9.5 3.8 4.3 5 3.6 10.1c-.9 5.6 2.6 11.1 6.2 11.1 1.3 0 1.6-.6 2.2-.6s1 .6 2.3.6c3.7 0 7.1-5.5 6.2-11.1C19.7 5 14.5 3.8 12 6.5ZM12 6.5C11.4 3.6 13.7 2 16 2M11.8 6.5C9.5 4.5 7 3.8 5 4.3'],
  chart:['M4 19v-4M9 19V9M14 19V12M19 19V5'],
  done:['M5.5 12.3 10 16.5 18.5 7.5'],
}
function symbol(kind) {
  const svg=document.createElementNS(NS,'svg')
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',class:'fn2__neo-symbol',focusable:'false','aria-hidden':'true'}))svg.setAttribute(k,v)
  for(const d of symbolPaths[kind]??[]) {
    const p=document.createElementNS(NS,'path');p.setAttribute('d',d)
    svg.append(p)
  }
  return svg
}
function perimeter(amount,goal) {
  const progress=clamp(percent(amount,goal))/100
  const svg=document.createElementNS(NS,'svg')
  svg.setAttribute('viewBox','0 0 300 260')
  svg.setAttribute('class','fn2__neo-outline')
  svg.setAttribute('role','img')
  svg.setAttribute('aria-label',Math.round(progress*100)+'% of calorie target consumed')
  const segments=[
    ['M240 246 H58 Q13 246 13 201 V175',0,.28],
    ['M13 169 V59 Q13 13 59 13 H147',.28,.24],
    ['M153 13 H242 Q287 13 287 59 V118',.52,.26],
    ['M287 125 V201 Q287 246 240 246',.78,.22],
  ]
  for(const [path,start,length] of segments) {
    const filled=clamp((progress-start)/length,0,1)
    for(const track of [true,false]){
      const node=document.createElementNS(NS,'path')
      node.setAttribute('d',path)
      node.setAttribute('class',track?'fn2__neo-perimeter-track':'fn2__neo-perimeter-live')
      node.setAttribute('pathLength','100')
      if(!track)node.setAttribute('stroke-dasharray',(Math.round(filled*10000)/100)+' 100')
      svg.append(node)
    }
  }
  return svg
}
function mealGrouping(ledger) {
  const names=['Breakfast','Lunch','Dinner','Snack']
  const buckets=new Map(names.map(x=>[x,0]))
  for(const entry of ledger.entries) {
    const d=new Date(entry.loggedAt)
    const h=Number.isFinite(d.getTime())?d.getHours():12
    const name=h>=5&&h<11?'Breakfast':h>=11&&h<16?'Lunch':h>=16&&h<21?'Dinner':'Snack'
    buckets.set(name,buckets.get(name)+val(entry.calories))
  }
  return names.map(name=>({name,calories:buckets.get(name)}))
}
function mealTile(meal,total) {
  const ratio=total>0?100*meal.calories/total:0
  return el('div.fn2__neo-meal',{dataset:{meal:meal.name.toLowerCase()}},[
    el('div.fn2__neo-meal-icon',{},[symbol(meal.name.toLowerCase())]),
    el('div.fn2__neo-meal-copy',{},[
      el('strong',{text:meal.name}),
      el('small',{text:fmt(meal.calories)+' kcal'}),
    ]),
    el('strong.fn2__neo-meal-pct',{text:Math.round(ratio)+'%'}),
  ])
}
function segmentedMeter(name,amount,goal) {
  const over=amount>goal && goal>0
  const leftover=Math.round(Math.abs(goal-amount))
  return el('div.fn2__neo-nutrient',{dataset:{macro:name.toLowerCase(),over:String(over)}},[
    el('div.fn2__neo-nutrient-head',{},[
      el('strong',{text:name}),
      el('span.fn2__neo-nutrient-count',{text:fmt(amount)+' g / '+fmt(goal)+' g'}),
      el('span.fn2__neo-nutrient-delta',{text:over?'(+'+fmt(leftover)+' g)': '('+fmt(leftover)+' g left)'}),
    ]),
    el('div.fn2__neo-meter',{role:'progressbar','aria-label':name+' progress','aria-valuenow':String(amount),
      'aria-valuemin':'0','aria-valuemax':String(goal),'data-color':over?'red':'blue'},
      Array.from({length:5},(_,i)=>{
        const fill=clamp((percent(amount,goal)-20*i)*5)
        return el('span.fn2__neo-meter-segment',{style:'--segment-fill:'+fill+'%'})
      })),
  ])
}
export function createFuelNeonWidget({day,calories,protein,calGoal,proGoal,macros,onCloseDay,onOtherNutrients}) {
  const ledger=nutritionLedger(day)
  const remaining=calGoal-calories
  const complete=day.nutritionStatus==='complete'
  const mealTotals=mealGrouping(ledger)
  const itemized=mealTotals.reduce((t,m)=>t+m.calories,0)
  const rest=calories-itemized
  return el('section.fn2__neo',{'aria-label':'Live nutrition totals',dataset:{foodNeon:'true',dayClosed:String(complete)}},[
    el('div.fn2__neo-body',{},[
      el('div.fn2__neo-calorie',{},[
        perimeter(calories,calGoal),
        el('div.fn2__neo-calorie-content',{},[
          el('div.fn2__neo-calorie-label',{},[symbol('flame'),el('strong',{text:'Calories'})]),
          el('strong.fn2__neo-calorie-value',{text:fmt(calories)}),
          el('span.fn2__neo-calorie-goal',{text:'of '+fmt(calGoal)+' kcal'}),
          el('div.fn2__neo-calorie-rule'),
          el('div.fn2__neo-calorie-stats',{},[
            el('div',{},[el('strong',{text:Math.round(percent(calories,calGoal))+'%'}),el('small',{text:'COMPLETE'})]),
            el('div',{dataset:{over:String(remaining<0)}},[el('strong',{text:fmt(Math.abs(remaining))}),el('small',{text:remaining<0?'OVER':'REMAINING'})]),
          ]),
        ]),
      ]),
      el('div.fn2__neo-meals',{},[
        ...mealTotals.map(m=>mealTile(m,calories)),
        Math.abs(rest)>=1&&el('small.fn2__neo-unassigned',{text:fmt(Math.abs(rest))+' kcal '+(rest>0?'from older/unassigned logs':'difference in logged totals')}),
      ]),
      el('div.fn2__neo-target',{},[
        el('div.fn2__neo-target-top',{},[el('span',{text:'TARGET'}),el('strong',{text:fmt(calGoal)+' kcal'})]),
        el('div.fn2__neo-target-line'),
        el('div.fn2__neo-target-bottom',{},[
          el('span',{text:remaining<0?'OVER TARGET':'REMAINING'}),
          el('strong',{dataset:{over:String(remaining<0)},text:fmt(Math.abs(remaining))+' kcal'}),
        ]),
      ]),
      el('div.fn2__neo-nutrients',{},[
        segmentedMeter('Protein',protein,proGoal),
        segmentedMeter('Carbs',ledger.totals.carbs,macros.carbs),
        segmentedMeter('Fat',ledger.totals.fat,macros.fat),
        segmentedMeter('Fiber',ledger.totals.fiber,macros.fiber),
      ]),
      el('div.fn2__neo-finish',{},[
        el('button.fn2__neo-close',{type:'button',dataset:{diaryFinishToday:'true'},
          'aria-label':complete?'Reopen nutrition day':'Close nutrition day',
          onclick:onCloseDay},[
          el('span.fn2__neo-check',{},[symbol('done')]),
          el('strong',{text:complete?'Reopen Day':'Close Day'}),
        ]),
      ]),
    ]),
    el('div.fn2__neo-footer',{},[
      el('button.fn2__neo-other',{type:'button',onclick:onOtherNutrients},[
        symbol('chart'),el('strong',{text:'Track other nutrients'}),el('span',{text:'›'}),
      ]),
    ]),
  ])
}
