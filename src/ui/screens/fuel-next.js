/**
 * Approved Food 2.0 candidate, isolated behind ?food2=1.
 * Actual totals and saved foods use Tempered's canonical stores.
 * Stock photos are illustration only, with guaranteed offline fallbacks.
 */
import { nutritionLedger, nutritionMacroTargets, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { mainTabBrand } from '../main-tab-header.js'
import { waterWavePath } from '../water-wave.js'
import { FOOD_PHOTOS, matchingFoodPhoto } from '../food-photos.js'
import { compressMealPhoto } from '../meal-photo.js'
import { createFuelNeonWidget } from '../fuel-neon-widget.js'
import { fuelAverage, shiftFuelDate } from '../../domain/fuel-average.js'

const PHOTOS = FOOD_PHOTOS
const n = x => Number.isFinite(Number(x)) ? Math.max(0,Number(x)) : 0
const fmt = x => Math.round(n(x)).toLocaleString()
const pct = (x,y) => y>0 ? Math.min(100,100*n(x)/y) : 0
const foodKey = x => JSON.stringify([x.description,x.calories,x.proteinGrams,x.carbsGrams,x.fatGrams,x.fiberGrams])
const labelTime = iso => {
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}) : ''
}
const mealType = hour => hour>=5&&hour<11?'Breakfast':hour>=11&&hour<16?'Lunch':hour>=16&&hour<21?'Dinner':'Snacks'

export function createFuelNextScreen({ storage,daily,clock }) {
  const root=el('div.screen.screen--fuel.screen--fuel-r4.fn2',{dataset:{foodTwo:'true'}})
  // One transient selected date drives dashboard AND entry actions.
  let selectedDate=clock.today()
  let averageEnd=shiftFuelDate(clock.today(),-1),closedOnly=true
  let data=null, prefs={},view='dashboard',sheet='',filter='all',query='',picked=null, journalDate=selectedDate
  let working=false, undo=null, errorMessage='', errorTimer=null, pickedDate=null, servingFood=null, servingAmount=1, servingOrigin='dashboard'
  let activeOverlay=null
  let weightGoalOpen=false,weightGoalValue='',weightGoalError=''
  let customWaterOpen=false,customWaterValue='',customWaterError='',customWaterSaving=false
  // Keep the prior painted fill across dashboard re-renders, so additions rise smoothly.
  let paintedWaterPercent=0
  let waterWaveFrame=0
  let waterWaveId=0
  const runtime=el('div.fn2__legacy-runtime')

  const updated = event => {if(root.isConnected&&(!event?.detail?.date||event.detail.date===selectedDate))refresh().catch(console.error)}
  window.addEventListener('tempered:fuel-updated',updated)
  window.addEventListener('tempered:nutrition-review-changed',updated)

  async function load() {
    const date=selectedDate
    const [days,now,profile]=await Promise.all([storage.getAll('dayLogs'),daily.forDate(date),storage.get('profile','profile')])
    if(date!==selectedDate)return // Superseded by a faster date selection.
    data={days,now,day:days.find(x=>x.date===date)??{date},foods:foodLibrary(days,4)}
    prefs=profile??{id:'profile'}
  }
  function target(id,fallback) {
    const activity=[...(data.now.logged??[]),...(data.now.outstanding??[])].find(x=>x.id===id)
    return n(activity?.dailyCap)||fallback
  }
  function photoOf(food) {
    const id=prefs.food2Photos?.[foodKey(food)]
    if(id==='none')return null
    return PHOTOS.find(x=>x.id===id)||matchingFoodPhoto(food.description)||null
  }
  function thumbnail(food,date=null) {
    const node=el('span.fn2__thumb')
    const day=date&&data?.days.find(row=>row.date===date)
    const personalPhoto=food.id&&day?.mealPhotos?.[food.id]
    const illustration=personalPhoto?null:photoOf(food)
    if(personalPhoto||illustration) {
      const tag=el('img',{src:personalPhoto||illustration.url,
        alt:personalPhoto?'Your saved meal photo':illustration.label+' (illustrative public-domain food photo)',loading:'lazy'})
      tag.onerror=()=>{tag.remove();node.classList.add('fn2__thumb--empty')}
      node.append(tag)
    } else node.classList.add('fn2__thumb--empty')
    node.append(el('span.fn2__thumb-icon',{},[icon('food')]))
    return node
  }
  // Successful saves are already apparent in the new totals. Reserve the
  // notification strip for unexpected errors, which disappear automatically.
  function clearError() {
    if(errorTimer)clearTimeout(errorTimer)
    errorTimer=null
    errorMessage=''
    const node=root.querySelector('[data-food2-status]')
    if(node)node.textContent=''
  }
  function showError(text) {
    clearError()
    errorMessage=text
    const node=root.querySelector('[data-food2-status]')
    if(node)node.textContent=text
    errorTimer=setTimeout(()=>{
      errorTimer=null
      errorMessage=''
      const current=root.querySelector('[data-food2-status]')
      if(current)current.textContent=''
    },4500)
  }
  async function savePrefs(values) {
    const profile=(await storage.get('profile','profile'))??{id:'profile'}
    await storage.put('profile',{...profile,...values})
    prefs={...profile,...values}
  }
  function toggleWeightGoal() {
    weightGoalOpen=!weightGoalOpen
    weightGoalValue=prefs.weightGoalLb ? String(prefs.weightGoalLb) : ''
    weightGoalError=''
    render()
    if(weightGoalOpen) requestAnimationFrame(()=>root.querySelector('[data-weight-goal-input]')?.focus())
  }
  async function saveWeightGoal(event) {
    event.preventDefault()
    const goal=Number(weightGoalValue)
    if(!weightGoalValue.trim()||!Number.isFinite(goal)||goal<70||goal>700){
      weightGoalError='Enter a goal between 70 and 700 lb.'
      render()
      return
    }
    try {
      await savePrefs({weightGoalLb:Math.round(goal*10)/10})
      weightGoalOpen=false
      weightGoalError=''
      render()
    } catch {
      weightGoalError='Unable to save the goal. Try again.'
      render()
    }
  }
  async function logWater(amount) {
    await daily.logAt(selectedDate,'water',amount)
    await refresh()
  }
  function toggleCustomWater() {
    customWaterOpen=!customWaterOpen
    customWaterError=''
    render()
    if(customWaterOpen) requestAnimationFrame(()=>root.querySelector('[data-custom-water-input]')?.focus())
  }
  async function saveCustomWater(event) {
    event.preventDefault()
    if(customWaterSaving)return
    const amount=Number(customWaterValue)
    if(!customWaterValue.trim()||!Number.isFinite(amount)||amount<0.1||amount>200) {
      customWaterError='Enter 0.1–200 oz.'
      render()
      return
    }
    customWaterSaving=true
    try {
      await daily.logAt(selectedDate,'water',Math.round(amount*10)/10)
      customWaterOpen=false
      customWaterValue=''
      customWaterError=''
      await refresh()
    } catch {
      customWaterError='Unable to log water. Try again.'
      render()
    } finally {
      customWaterSaving=false
    }
  }
  async function favorite(food) {
    const favoriteSet=new Set(prefs.food2Favorites??[])
    const key=foodKey(food)
    favoriteSet.has(key)?favoriteSet.delete(key):favoriteSet.add(key)
    await savePrefs({food2Favorites:[...favoriteSet]})
    render()
  }
  function openFullHistory(trigger) {
    window.dispatchEvent(new CustomEvent('tempered:open-nutrition', {
      detail:{ trigger, date:selectedDate, focus:'history' },
    }))
  }
  function heading(){
    return el('header.fn2__heading',{},[
      el('div.lfms-main-heading',{},[
        mainTabBrand('Fuel', {
          brandClass: 'fn2__brand', markClass: 'lfms__fuel-mark',
        }),
      ]),
      el('nav.fn2__pills.lfms-main-actions',{'aria-label':'Food shortcuts'},[
        el('button',{type:'button',onclick:()=>go('library')},[icon('search'),' Food Library']),
        el('button',{type:'button',dataset:{foodLogNav:'true'},'aria-current':view==='log'?'page':null,onclick:()=>go('log')},[icon('plus'),' Log']),
        el('button',{type:'button','aria-current':view==='journal'?'page':null,onclick:()=>go('journal')},[icon('journal'),' Meal History']),
        el('button',{type:'button',dataset:{fuelAverage:'true'},'aria-current':view==='average'?'page':null,
          onclick:()=>{averageEnd=selectedDate===clock.today()?shiftFuelDate(selectedDate,-1):selectedDate;go('average')}},[icon('chart'),' 7-day average']),
      ]),
    ])
  }
  const toISO=date=>date.toISOString().slice(0,10)
  function shiftDate(date,days) {
    const utc=new Date(date+'T12:00:00Z')
    utc.setUTCDate(utc.getUTCDate()+days)
    return toISO(utc)
  }
  function weekStart(date) {
    const utc=new Date(date+'T12:00:00Z')
    utc.setUTCDate(utc.getUTCDate()-(utc.getUTCDay()+6)%7)
    return utc
  }
  const formattedDate=date=>new Date(date+'T12:00:00Z')
    .toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
  async function selectFuelDate(date) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>clock.today()||date===selectedDate)return
    selectedDate=date
    journalDate=date
    // Changing the date is navigation. It must never write a dayLog.
    sheet='';picked=null;pickedDate=null;servingFood=null;servingAmount=1
    await refresh()
  }
  function dateToolbar() {
    const today=clock.today(),monday=weekStart(selectedDate),sunday=new Date(monday)
    sunday.setUTCDate(sunday.getUTCDate()+6)
    const range=monday.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})
      +' – '+sunday.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})
    return el('nav.fn2__date-toolbar',{'aria-label':'Choose Fuel day',dataset:{fuelDateToolbar:'true'}},[
      el('button.fn2__date-week-arrow',{type:'button','aria-label':'Previous week',
        onclick:()=>selectFuelDate(shiftDate(selectedDate,-7))},['‹']),
      el('label.fn2__date-picker-inline',{},[
        el('span.fn2__date-picker-caption',{text:(selectedDate===today?'Today · ':'Viewing · ')+formattedDate(selectedDate)}),
        el('small',{text:range}),
        el('input',{type:'date',value:selectedDate,max:today,
          'aria-label':'Choose Fuel dashboard date',onchange:event=>selectFuelDate(event.target.value)}),
      ]),
      el('button.fn2__date-week-arrow',{type:'button','aria-label':'Next week',
        disabled:selectedDate===today,
        onclick:()=>selectFuelDate(shiftDate(selectedDate,7)>today?today:shiftDate(selectedDate,7))},['›']),
      selectedDate!==today&&el('button.fn2__back-today',{type:'button',
        'aria-label':'Return Fuel to today',onclick:()=>selectFuelDate(today)},['Today']),
    ])
  }
  function week() {
    const today=clock.today(),monday=weekStart(selectedDate)
    return el('div.fn2__week',{'aria-label':'Fuel days this week'},Array.from({length:7},(_,i)=>{
      const d=new Date(monday);d.setUTCDate(monday.getUTCDate()+i)
      const iso=toISO(d),record=data.days.find(x=>x.date===iso)
      return el('button',{type:'button',disabled:iso>today,
        'aria-label':formattedDate(iso)+(iso===selectedDate?', selected':''),
        'aria-pressed':String(iso===selectedDate),
        dataset:{fuelDate:iso,today:String(iso===today),selected:String(iso===selectedDate)},
        onclick:()=>selectFuelDate(iso)},[
        el('small',{text:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}),
        el('b',{text:String(d.getUTCDate())}),
        el('i',{text:record?.nutritionStatus==='complete'?'✓':record?.nutritionLogged?'◐':'·'}),
      ])
    }))
  }
  function waterGoalFigure(amount, goal) {
    const progress=pct(amount,goal)
    const percent=Math.round(progress)
    // Exact same sidebar SVG on both layers; intersect the blue copy with an
    // SVG-native wave clip. No glow, overlay rectangle, or spill outside the figure.
    const filledIcon=icon('nav-train')
    const ns='http://www.w3.org/2000/svg'
    const clipId='lfms-water-wave-'+(++waterWaveId)
    const defs=document.createElementNS(ns,'defs')
    const clip=document.createElementNS(ns,'clipPath')
    clip.setAttribute('id',clipId)
    clip.setAttribute('data-water-clip','true')
    clip.setAttribute('clipPathUnits','userSpaceOnUse')
    const wave=document.createElementNS(ns,'path')
    wave.setAttribute('data-water-wave-path','true')
    wave.setAttribute('d',waterWavePath(paintedWaterPercent))
    clip.append(wave)
    defs.append(clip)
    const glyph=document.createElementNS(ns,'g')
    glyph.setAttribute('clip-path','url(#'+clipId+')')
    while(filledIcon.firstChild)glyph.append(filledIcon.firstChild)
    filledIcon.append(defs,glyph)
    return el('div.fn2__water-figure',{
      role:'meter',
      'aria-label':'Water goal completion',
      'aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(percent),
      'aria-valuetext':fmt(amount)+' of '+fmt(goal)+' oz logged, '+percent+'% of goal',
      dataset:{waterGoalFigure:'true',waterPercent:String(percent)},
    },[
      el('div.fn2__water-figure-art',{'aria-hidden':'true'},[
        el('span.fn2__water-figure-empty',{},[icon('nav-train')]),
        el('span.fn2__water-figure-fill',{dataset:{waterFigureFill:'true'}},[filledIcon]),
      ]),
      el('span.fn2__water-figure-percent',{text:percent+'%'}),
    ])
  }
  function dashboard() {
    const day=data.day,ledger=nutritionLedger(day)
    const calories=n(day.calories),protein=n(day.proteinGrams),calGoal=target('calories_logged',2100),proGoal=target('protein_target',135)
    const macros=nutritionMacroTargets(calGoal,proGoal)
    const lastWeight=[...data.days].filter(x=>x.date<=selectedDate&&n(x.bodyMetrics?.weight)>0)
      .sort((a,b)=>b.date.localeCompare(a.date))[0]?.bodyMetrics?.weight
    const goal=Number(prefs.weightGoalLb)
    const hasGoal=Number.isFinite(goal)&&goal>=70&&goal<=700
    const difference=lastWeight&&hasGoal?Math.round((Number(lastWeight)-goal)*10)/10:null
    const goalComparison=!hasGoal?'Set a goal to compare'
      :!lastWeight?'Goal: '+goal.toFixed(1)+' lb · log your weight'
      :difference===0?'At your '+goal.toFixed(1)+' lb goal'
      :difference>0?difference.toFixed(1)+' lb to goal · '+goal.toFixed(1)+' lb target'
      :Math.abs(difference).toFixed(1)+' lb below '+goal.toFixed(1)+' lb goal'
    return [
      heading(),dateToolbar(),week(),
      createFuelNeonWidget({
        day,calories,protein,calGoal,proGoal,macros,
        onOtherNutrients:event=>openFullHistory(event.currentTarget),
        onCloseDay:async()=>{
          await daily.setNutritionStatus(selectedDate,day.nutritionStatus==='complete'?'partial':'complete')
          await refresh()
        },
      }),
      el('div.fn2__stats.fn2__stats--two',{},[
        el('section.fn2__stat.fn2__stat--weight',{},[
          el('h2',{},[icon('body'),' Weight']),
          el('strong',{text:lastWeight?Number(lastWeight).toFixed(1)+' lb':'—'}),
          el('small.fn2__weight-comparison',{text:goalComparison}),
          el('button.fn2__stat-link',{type:'button',
            'aria-expanded':String(weightGoalOpen),onclick:toggleWeightGoal,
          },[hasGoal?'Change goal':'Set goal']),
          weightGoalOpen&&el('form.fn2__stat-form',{onsubmit:saveWeightGoal},[
            el('label',{},[
              el('span',{text:'Goal (lb)'}),
              el('input',{type:'number',min:'70',max:'700',step:'0.1',inputMode:'decimal',
                value:weightGoalValue,placeholder:'150',dataset:{weightGoalInput:'true'},
                'aria-label':'Target body weight in pounds',
                oninput:e=>{weightGoalValue=e.target.value;weightGoalError=''},
              }),
            ]),
            el('button',{type:'submit'},['Save']),
            weightGoalError&&el('small.fn2__stat-error',{role:'alert',text:weightGoalError}),
          ]),
        ]),
        el('section.fn2__stat.fn2__stat--water',{},[
          el('h2',{},[icon('water'),' Water']),
          el('div.fn2__water-top',{},[
            el('div.fn2__water-readout',{},[
              el('strong',{text:fmt(day.waterOz)+' oz'}),
              el('small',{text:'of '+fmt(target('water',120))+' oz goal'}),
            ]),
            waterGoalFigure(n(day.waterOz),target('water',120)),
          ]),
          el('div.fn2__water-actions',{},[
            ...[8,12,25].map(a=>el('button',{type:'button',onclick:()=>logWater(a)},['+'+a])),
            el('button.fn2__water-custom-toggle',{type:'button',
              'aria-expanded':String(customWaterOpen),onclick:toggleCustomWater,
            },[customWaterOpen?'Cancel':'+ Custom']),
          ]),
          customWaterOpen&&el('form.fn2__stat-form',{onsubmit:saveCustomWater},[
            el('label',{},[
              el('span',{text:'Add water (oz)'}),
              el('input',{type:'number',min:'0.1',max:'200',step:'0.1',inputMode:'decimal',
                value:customWaterValue,placeholder:'16',dataset:{customWaterInput:'true'},
                'aria-label':'Custom water amount in ounces',
                oninput:e=>{customWaterValue=e.target.value;customWaterError=''},
              }),
            ]),
            el('button',{type:'submit',disabled:customWaterSaving},['Add']),
            customWaterError&&el('small.fn2__stat-error',{role:'alert',text:customWaterError}),
          ]),
        ]),
      ]),
      macroJournal(day),
    ]
  }
  function averageDashboard() {
    const summary=fuelAverage(data.days,averageEnd,{closedOnly})
    const calGoal=target('calories_logged',2100),proGoal=target('protein_target',135)
    const {averages,counts}=summary,delta=averages.calories===null?null:averages.calories-calGoal
    const short=date=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})
    const latestEnd=shiftFuelDate(clock.today(),-1)
    return [heading(),
      el('section.fn2__average-heading',{},[
        el('button.fn2__back-today',{type:'button',onclick:()=>go('dashboard')},['‹ Back to daily']),
        el('h2',{text:'7-day average'}),
        el('p',{text:short(summary.start)+' – '+short(summary.end)+' · today excluded'}),
        el('div.fn2__average-controls',{},[
          el('button',{type:'button','aria-label':'Previous seven days',onclick:()=>{averageEnd=shiftFuelDate(averageEnd,-7);render()}},['‹']),
          el('div.fn2__average-basis',{role:'group','aria-label':'Average day coverage'},[
            ...[[true,'Closed days'],[false,'All recorded days']].map(([value,label])=>el('button',{type:'button',
              'aria-pressed':String(closedOnly===value),onclick:()=>{closedOnly=value;render()}},[label])),
          ]),
          el('button',{type:'button','aria-label':'Next seven days',disabled:averageEnd>=latestEnd,
            onclick:()=>{averageEnd=shiftFuelDate(averageEnd,7)>latestEnd?latestEnd:shiftFuelDate(averageEnd,7);render()}},['›']),
        ]),
        el('p.fn2__average-note',{text:summary.closed+' closed · '+(summary.recorded-summary.closed)+' partial / open · '+(7-summary.recorded)+' unrecorded. '+
          (closedOnly?'Average uses closed days only.':'Includes unfinished logs; this may understate intake.')+' Missing days are excluded.'}),
      ]),
      createFuelNeonWidget({day:summary.day,calories:averages.calories,protein:averages.protein,calGoal,proGoal,
        macros:nutritionMacroTargets(calGoal,proGoal),average:{...averages,included:summary.included},
        onOtherNutrients:()=>go('dashboard')}),
      el('section.fn2__average-detail',{},[
        el('h3',{text:delta===null?'Close a logged day to see your average':
          'Averaging '+fmt(Math.abs(delta))+' kcal / day '+(delta>0?'over':delta<0?'below':'at')+' your current target'}),
        el('p',{text:delta===null?'No eligible calorie days in this window.':
          'Based on '+summary.included+' '+(closedOnly?'closed':'recorded')+' days against your current '+fmt(calGoal)+' kcal target. '+
          (summary.included<7?'Coverage is incomplete; collect the remaining days before deciding on a target change.':'Review this alongside your weight trend before changing your target.')}),
        el('small',{text:'Macro sample counts: protein '+counts.protein+', carbs '+counts.carbs+', fat '+counts.fat+', fiber '+counts.fiber+'. Missing nutrients are excluded from their own averages. Meal tiles show the average logged meal calories per included day.'}),
        el('div.fn2__average-days',{},summary.rows.map(row=>el('button',{type:'button',
          'aria-label':'View Fuel for '+formattedDate(row.date),onclick:async()=>{view='dashboard';await selectFuelDate(row.date);render()}},[
          el('span',{text:short(row.date)}),
          el('strong',{text:row.recorded?fmt(row.observations.calories)+' kcal':'—'}),
          el('small',{text:row.closed&&row.recorded?'Closed':row.recorded?'Partial / open':'Unrecorded'}),
        ]))),
      ]),
    ]
  }
  function grouped(day) {
    const a=new Map(['Breakfast','Lunch','Dinner','Snacks'].map(x=>[x,[]]))
    for(const entry of nutritionLedger(day).entries){
      const hour=new Date(entry.loggedAt).getHours()
      a.get(mealType(hour)).push(entry)
    }
    return a
  }
  function mealRow(food,date) {
    return el('div.fn2__meal-row',{},[
      el('button.fn2__meal-photo',{type:'button',
        'aria-label':'Add or change photo for '+(food.description||'meal'),
        onclick:()=>{picked=food;pickedDate=date;openSheet('attach-photo')}},[thumbnail(food,date)]),
      el('span.fn2__meal-info',{},[
        el('strong',{text:food.description||'Food entry'}),
        el('small',{text:labelTime(food.loggedAt)+' · '+(food.portion??1)+' serving'}),
        el('span',{text:fmt(food.calories)+' cal · '+fmt(food.proteinGrams)+'p · '+fmt(food.carbsGrams)+'c · '+fmt(food.fatGrams)+'f'}),
      ]),
      el('button.fn2__meal-menu',{type:'button','aria-label':'Meal actions for '+food.description,
        onclick:()=>{picked=food;pickedDate=date;openSheet('actions')}},['⋮']),
    ])
  }
  function mealSections(day,{inline=false}={}) {
    return [...grouped(day)].map(([name,entries])=>el('section.fn2__meal-group'+(inline?' fn2__meal-group--inline':''),{},[
      el('div.fn2__meal-group-title',{},[
        el('strong',{text:name}),
        el('button',{type:'button','aria-label':'Quick log food for '+name,
          onclick:()=>go('log')},['+']),
      ]),
      ...entries.map(food=>mealRow(food,day.date)),
      entries.length===0&&el('small.fn2__meal-empty',{text:'No meals logged'}),
      entries.length>0&&el('div.fn2__group-total',{text:'Total: '+fmt(entries.reduce((s,e)=>s+n(e.calories),0))+' cal · '+fmt(entries.reduce((s,e)=>s+n(e.proteinGrams),0))+'g protein'}),
    ]))
  }
  function macroJournal(day) {
    const ledger=nutritionLedger(day)
    return el('section.fn2__macro-journal',{'aria-label':'Daily macro journal'},[
      el('div.fn2__macro-journal-head',{},[
        el('h2',{text:'Macro Journal'}),
        el('button',{type:'button',onclick:()=>{journalDate=selectedDate;go('journal')}},['More ', '›']),
      ]),
      el('p.fn2__macro-journal-sub',{text:fmt(ledger.totals.calories)+' kcal · '+fmt(ledger.totals.protein)+'g protein · '+ledger.entries.length+' meals'}),
      el('div.fn2__journal',{},mealSections(day,{inline:true})),
    ])
  }
  async function attachMealPhoto(file) {
    if(!file||!picked?.id||!pickedDate||working)return
    working=true
    try {
      const image=await compressMealPhoto(file)
      const day=await daily.dayLog(pickedDate)
      if(!nutritionLedger(day).entries.some(e=>e.id===picked.id))throw new Error('This meal is no longer available.')
      await storage.put('dayLogs',{...day,mealPhotos:{...(day.mealPhotos??{}),[picked.id]:image}})
      sheet='';picked=null;pickedDate=null
      await refresh()
      clearError()
    } catch(error) {
      const message=error instanceof Error?error.message:'Could not read that photo'
      showError(message)
    } finally { working=false }
  }
  async function removeMealPhoto() {
    if(!picked?.id||!pickedDate||working)return
    working=true
    try {
      const day=await daily.dayLog(pickedDate)
      const photos={...(day.mealPhotos??{})}
      delete photos[picked.id]
      await storage.put('dayLogs',{...day,mealPhotos:photos})
      sheet='';picked=null;pickedDate=null
      await refresh()
      clearError()
    } catch { showError('Could not remove photo') }
    finally { working=false }
  }
  async function deletePicked() {
    if(!picked||working)return
    working=true
    try{
      const date=pickedDate??journalDate
      const r=await daily.removeNutrition(date,picked.id)
      undo=r.removed?{entry:r.removed,index:r.index,date}:null
      sheet='';picked=null;pickedDate=null
      await refresh()
      window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
      clearError()
    }catch{showError('Could not delete meal')}finally{working=false}
  }
  async function restore() {
    if(!undo)return
    const saved=undo;undo=null
    await daily.restoreNutrition(saved.date,saved.entry,saved.index)
    await refresh()
    window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
  }
  function setJournalDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > clock.today()) return
    journalDate=date
    sheet='';picked=null;pickedDate=null
    render()
  }
  function shiftJournalDate(days) {
    const date=new Date(journalDate+'T12:00:00Z')
    date.setUTCDate(date.getUTCDate()+days)
    setJournalDate(date.toISOString().slice(0,10))
  }
  function journal() {
    const day=data.days.find(row=>row.date===journalDate)??{date:journalDate}
    const ledger=nutritionLedger(day)
    const isToday=journalDate===clock.today()
    const displayDate=new Date(journalDate+'T12:00:00Z')
      .toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
    return [
      heading(),
      el('div.fn2__title.fn2__history-title',{},[
        el('h1',{text:'Meal History'}),
        el('button.fn2__return-fuel',{type:'button','aria-label':'Back to Fuel',
          title:'Back to Fuel',onclick:()=>go('dashboard')},[
          icon('nav-fuel'),
        ]),
      ]),
      el('nav.fn2__history-nav',{'aria-label':'Browse meal history by date'},[
        el('button.fn2__history-arrow',{type:'button','aria-label':'Previous day',
          title:'Previous day',onclick:()=>shiftJournalDate(-1)},['‹']),
        el('label.fn2__date-picker',{},[
          el('span.fn2__date-picker-display',{},[
            icon('calendar'),
            el('span',{text:displayDate}),
          ]),
          el('input',{type:'date',value:journalDate,max:clock.today(),
            'aria-label':'Choose meal history date',
            onchange:event=>setJournalDate(event.target.value)}),
        ]),
        el('button.fn2__history-arrow',{type:'button','aria-label':'Next day',title:'Next day',
          disabled:isToday,onclick:()=>shiftJournalDate(1)},['›']),
        !isToday&&el('button.fn2__history-today',{type:'button',
          onclick:()=>setJournalDate(clock.today())},['Today']),
      ]),
      el('div.fn2__history-summary',{},[
        el('strong',{text:fmt(ledger.totals.calories)+' kcal · '+fmt(ledger.totals.protein)+'g protein'}),
        el('span',{text:ledger.entries.length+' meal'+(ledger.entries.length===1?'':'s')+' logged'}),
      ]),
      el('div.fn2__journal',{},[
        !ledger.entries.length&&el('p.fn2__history-empty',{text:'No individual meals logged for this date.'}),
        ...mealSections(day),
        ledger.hasCarryover&&el('small.fn2__carryover',{text:'Older aggregate totals remain counted even when no individual meal records exist.'}),
        undo?.date===journalDate&&el('button.fn2__undo',{type:'button',onclick:restore},['Undo deleted meal']),
      ]),
    ]
  }
  // Match a manually selected historical day while preserving the user's
  // local meal time. Defaulting to clock.nowIso would misdate a backfilled meal.
  function nutritionTimestamp(date) {
    if(date===clock.today())return clock.nowIso()
    const now=new Date(clock.now())
    const [year,month,day]=date.split('-').map(Number)
    return new Date(year,month-1,day,now.getHours(),now.getMinutes(),
      now.getSeconds(),now.getMilliseconds()).toISOString()
  }
  // A historical entry already contains eaten (possibly fractional) amounts.
  // Convert it back to one-serving values before repeating; otherwise a
  // half-serving meal gets multiplied twice.
  function repeatableFood(entry) {
    const portion=Number(entry?.portion)>0?Number(entry.portion):1
    const per={description:entry.description}
    for(const key of ['calories','proteinGrams','carbsGrams','fatGrams','fiberGrams']) {
      if(Number.isFinite(Number(entry?.[key]))) per[key]=Math.round(Number(entry[key])/portion*10000)/10000
    }
    return per
  }
  const servingChoices=[0.25,0.5,0.75,1,1.5,2,3,4]
  const portionLabel=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:6})
  function servingValid(value) {return Number.isFinite(value)&&value>=0.05&&value<=20}
  function openServing(food) {
    servingFood=repeatableFood(food)
    servingAmount=1
    servingOrigin=view
    sheet='serving'
    render()
  }
  function updateServingAmount(value,{refresh=false}={}) {
    const numeric=Number(value)
    servingAmount=String(value).trim()!==''&&servingValid(numeric)?numeric:null
    if(refresh){render();return}
    const preview=activeOverlay?.querySelector('[data-serving-preview]')
    if(preview)preview.textContent=servingAmount===null
      ?'Enter an amount between 0.05 and 20 servings.'
      :fmt(n(servingFood?.calories)*servingAmount)+' kcal · '+fmt(n(servingFood?.proteinGrams)*servingAmount)+'g protein'
    const submit=activeOverlay?.querySelector('[data-serving-submit]')
    if(submit) {
      submit.disabled=servingAmount===null
      submit.textContent=servingAmount===null?'Choose a serving':'Log '+portionLabel(servingAmount)+' serving'+(servingAmount===1?'':'s')
    }
    for(const button of activeOverlay?.querySelectorAll('[data-serving-preset]')??[]) {
      button.setAttribute('aria-pressed',String(Number(button.dataset.servingPreset)===servingAmount))
    }
  }
  function servingPicker() {
    const food=servingFood??{}
    return [
      el('div.fn2__serving-food',{},[
        thumbnail(food),
        el('div',{},[
          el('strong',{text:food.description||'Saved food'}),
          el('small',{text:fmt(food.calories)+' kcal · '+fmt(food.proteinGrams)+'g protein per serving'}),
        ]),
      ]),
      el('p.fn2__caption',{text:'For '+formattedDate(selectedDate)+' · Choose a portion. Nothing is logged until you confirm.'}),
      el('div.fn2__serving-presets',{'aria-label':'Quick serving amounts'},
        servingChoices.map(amount=>el('button',{type:'button',dataset:{servingPreset:String(amount)},
          'aria-pressed':String(servingAmount===amount),onclick:()=>updateServingAmount(amount,{refresh:true})},
          [portionLabel(amount)+'×']))),
      el('label.fn2__serving-custom',{},[
        el('span',{text:'Custom servings'}),
        el('input',{type:'number',min:'0.05',max:'20',step:'any',inputMode:'decimal',
          value:String(servingAmount??''),'aria-label':'Custom serving amount',
          oninput:event=>updateServingAmount(event.target.value)}),
      ]),
      el('strong.fn2__serving-preview',{dataset:{servingPreview:'true'},
        text:servingAmount===null?'Enter an amount between 0.05 and 20 servings.':
          fmt(n(food.calories)*servingAmount)+' kcal · '+fmt(n(food.proteinGrams)*servingAmount)+'g protein'}),
      el('div.fn2__serving-error',{dataset:{servingError:'true'},role:'alert'}),
      el('button.fn2__primary',{type:'button',dataset:{servingSubmit:'true'},
        disabled:servingAmount===null||working,onclick:logServing},
        ['Log '+portionLabel(servingAmount??1)+' serving'+(servingAmount===1?'':'s')]),
    ]
  }
  async function logServing() {
    if(working||!servingFood||!servingValid(servingAmount))return
    working=true
    const food=servingFood,amount=servingAmount,origin=servingOrigin
    const submit=activeOverlay?.querySelector('[data-serving-submit]')
    if(submit)submit.disabled=true
    try {
      const {lastLoggedAt,loggedAt,id:entryId,source,count,...values}=food
      await daily.addNutrition(selectedDate,{...values,portion:amount},{loggedAt:nutritionTimestamp(selectedDate)})
      servingFood=null;servingAmount=1;sheet='';view=origin
      await refresh()
      window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
      clearError()
    }catch(error){
      const warning=activeOverlay?.querySelector('[data-serving-error]')
      if(warning)warning.textContent='Could not log this meal. Please try again.'
      if(submit)submit.disabled=false
    }finally{working=false}
  }
  function libraryRows(){
    let foods=[...data.foods.all]
    if(filter==='frequent')foods=foods.filter(x=>x.count>1).sort((a,b)=>b.count-a.count)
    if(filter==='recent')foods.sort((a,b)=>b.lastLoggedAt.localeCompare(a.lastLoggedAt))
    if(filter==='favorites')foods=foods.filter(x=>(prefs.food2Favorites??[]).includes(foodKey(x)))
    foods=searchFoods(foods,query)
    if(!foods.length)return [el('p.fn2__empty',{text:query?'No matching saved foods.':'Your logged foods will appear here.'})]
    return foods.slice(0,120).map(food=>el('div.fn2__food-row',{},[
      el('button.fn2__photo-choice',{type:'button','aria-label':'Choose photo for '+food.description,onclick:()=>{picked=food;openSheet('photo')}},[thumbnail(food)]),
      el('span.fn2__food-info',{},[
        el('strong',{text:food.description}),
        el('small',{text:fmt(food.calories)+' kcal · '+fmt(food.proteinGrams)+'g P · '+food.count+'×'}),
      ]),
      el('button.fn2__fav',{type:'button','aria-label':'Toggle favorite '+food.description,onclick:()=>favorite(food)},[(prefs.food2Favorites??[]).includes(foodKey(food))?'♥':'♡']),
      el('button.fn2__add',{type:'button','aria-label':'Add '+food.description,onclick:()=>openServing(food)},['+']),
    ]))
  }
  async function favorite(food) {
    const key=foodKey(food),current=new Set(prefs.food2Favorites??[])
    current.has(key)?current.delete(key):current.add(key)
    const profile=(await storage.get('profile','profile'))??{id:'profile'}
    await storage.put('profile',{...profile,food2Favorites:[...current]})
    prefs={...profile,food2Favorites:[...current]}
    render()
  }
  async function assignPhoto(id) {
    if(!picked)return
    const profile=(await storage.get('profile','profile'))??{id:'profile'}
    const photos={...(profile.food2Photos??{}),[foodKey(picked)]:id}
    await storage.put('profile',{...profile,food2Photos:photos})
    prefs={...profile,food2Photos:photos};closeSheet()
  }
  function logPage() {
    const favorites=new Set(prefs.food2Favorites??[])
    const saved=data.foods.all.filter(food=>favorites.has(foodKey(food)))
    return [
      heading(),
      el('div.fn2__title',{},[
        el('div',{},[
          el('h1',{text:'Log a meal'}),
          el('small.fn2__log-date',{dataset:{logDate:selectedDate},text:'For '+formattedDate(selectedDate)}),
        ]),
        el('button',{type:'button',onclick:()=>go('dashboard')},['Back to Fuel']),
      ]),
      // The canonical nutrition form is shown first, never behind Quick Log.
      // We only hide its duplicated history card; Meal History stays in its
      // own dedicated page. Existing camera, AI paste and add handlers remain.
      el('section.fn2__log-entry',{'aria-label':'Log a meal'},[runtime]),
      el('section.fn2__log-favorites',{'aria-label':'Favorite foods'},[
        el('div.fn2__log-favorites-head',{},[
          el('div',{},[
            el('p.fn2__log-kicker',{text:'SAVED SHORTCUTS'}),
            el('h2',{text:'Favorites'}),
          ]),
          el('button',{type:'button',onclick:()=>{filter='favorites';query='';go('library')}},['Manage favorites ›']),
        ]),
        saved.length
          ?el('div.fn2__log-favorite-list',{},saved.slice(0,24).map(food=>
            el('button.fn2__log-favorite',{type:'button',
              'aria-label':'Log favorite '+food.description,
              onclick:()=>openServing(food)},[
              thumbnail(food),
              el('span.fn2__log-favorite-copy',{},[
                el('strong',{text:food.description}),
                el('small',{text:fmt(food.calories)+' kcal · '+fmt(food.proteinGrams)+'g protein per serving'}),
              ]),
              el('span.fn2__log-favorite-plus',{text:'+'}),
            ])))
          :el('div.fn2__log-empty',{},[
            el('p',{text:'No favorites yet. Star foods in your library for one-tap access here.'}),
            el('button',{type:'button',onclick:()=>{filter='all';query='';go('library')}},['Browse Food Library']),
          ]),
      ]),
    ]
  }
  function library() {
    const results=el('div.fn2__food-results',{},libraryRows())
    return [
      heading(),
      el('div.fn2__title',{},[
        el('div',{},[el('h1',{text:'Food Library'}),el('small.fn2__log-date',{text:'Logging for '+formattedDate(selectedDate)})]),
        el('button',{type:'button',onclick:()=>go('dashboard')},['Back to Fuel']),
      ]),
      el('nav.fn2__filters',{'aria-label':'Saved food filters'},[
        ...[['all','All Foods'],['frequent','Frequent'],['recent','Recent'],['favorites','Favorites']].map(([key,label])=>el('button',{
          type:'button','aria-pressed':String(key===filter),onclick:()=>{filter=key;render()},
        },[label])),
      ]),
      el('label.fn2__search',{},[icon('search'),el('input',{
        type:'search',value:query,placeholder:'Search saved foods','aria-label':'Search saved foods',
        oninput:event=>{query=event.target.value;replace(results,libraryRows())},
      })]),
      el('div.fn2__library',{},[
        el('section.fn2__library-list',{},[results]),
      ]),
      el('p.fn2__caption',{text:'Tap + to choose servings and log a saved food. Photos are illustrative.'}),
    ]
  }
  function mountRuntime(){
    runtime.dataset.date=selectedDate
    window.dispatchEvent(new CustomEvent('tempered:mount-nutrition-panel',{detail:{slot:runtime,date:selectedDate}}))
  }
  function overlay(){
    const title={quick:'Log',serving:'Log meal',manual:'Log',photo:'Choose illustration',actions:'Meal actions','attach-photo':'Meal photo'}[sheet]
    // A new user has zero frequent foods; several distinct foods may also
    // have no repeat count yet. Quick Log must not become an empty giant sheet.
    const quickFoods=data.foods.top.length?data.foods.top:data.foods.all.slice(0,5)
    const content=sheet==='quick'?[
      el('p.fn2__caption',{text:'Choose a recent meal, then enter your serving amount.'}),
      !quickFoods.length&&el('p.fn2__empty',{text:'No saved meals yet. Enter your first meal below.'}),
      ...quickFoods.map(food=>el('button.fn2__quick-food',{type:'button',onclick:()=>openServing(food)},[
        thumbnail(food),el('span',{text:food.description}),el('strong',{text:fmt(food.calories)+' kcal'}),icon('plus'),
      ])),
      el('button.fn2__secondary',{type:'button',onclick:()=>go('library')},['Browse all saved foods']),
      el('button.fn2__primary',{type:'button',onclick:()=>openSheet('manual')},['Manual entry · Meal photo · Import nutrition']),
    ]:sheet==='serving'?servingPicker():sheet==='photo'?[
      el('p.fn2__caption',{text:'Images are optional illustrations and never determine nutrition. Unknown foods use an offline placeholder.'}),
      el('div.fn2__photo-picker',{},[
        ...PHOTOS.map(p=>el('button',{type:'button',onclick:()=>assignPhoto(p.id)},[
          el('img',{src:p.url,alt:p.name}),el('small',{text:p.label}),
        ])),
        el('button',{type:'button',onclick:()=>assignPhoto('none')},[icon('food'),' No image']),
      ]),
    ]:sheet==='attach-photo'?[
      el('p.fn2__caption',{text:'Add a real photo to this meal. It stays on this device and is included in LFMS exports. Photos do not change nutrition totals.'}),
      el('label.fn2__upload-photo',{},[
        icon('plus'),el('span',{text:'Take or choose a photo'}),
        el('input',{type:'file',accept:'image/*,.heic,.heif',
          'aria-label':'Choose photo for meal',onchange:event=>attachMealPhoto(event.target.files?.[0])}),
      ]),
      pickedDate&&picked&&data.days.find(row=>row.date===pickedDate)?.mealPhotos?.[picked.id]
        &&el('button.fn2__secondary',{type:'button',onclick:removeMealPhoto},['Remove this meal photo']),
    ]:sheet==='actions'?[
      el('button.fn2__secondary',{type:'button',onclick:()=>openSheet('attach-photo')},['Add or replace meal photo']),
      el('button.fn2__secondary',{type:'button',onclick:closeSheet},['Back to Meal History']),
      el('button.fn2__secondary',{type:'button',onclick:()=>{const x=picked;picked=null;openServing(x)}},['Log this meal again']),
      el('button.fn2__secondary',{type:'button',onclick:deletePicked},['Delete meal (Undo available)']),
    ]:[runtime]
    return el('div.fn2__overlay.fn2__portal',{dataset:{food2Overlay:sheet},onkeydown:e=>{if(e.key==='Escape')closeSheet()}},[
      el('button.fn2__shade',{type:'button',onclick:closeSheet,'aria-label':'Close logging'}),
      el('section.fn2__sheet',{role:'dialog','aria-modal':'true','aria-label':title},[
        el('header.fn2__sheet-head',{},[el('h2',{text:title}),el('button.fn2__sheet-close',{type:'button',onclick:closeSheet,'aria-label':'Close'},['×'])]),
        el('div.fn2__sheet-body',{},content),
      ]),
    ])
  }
  function openSheet(name) {
    sheet=name;render()
    if(name==='manual')requestAnimationFrame(()=>activeOverlay?.querySelector('[data-entry="nutrition_description"]')?.focus({preventScroll:true}))
  }
  function closeSheet() {sheet='';picked=null;pickedDate=null;servingFood=null;servingAmount=1;render()}
  function go(name){clearError();view=name;sheet='';picked=null;pickedDate=null;servingFood=null;servingAmount=1;render()}
  function render() {
    if(!data)return
    root.dataset.selectedDate=selectedDate
    // Cancel the prior frame before replacing its SVG; the most recently
    // painted fill is retained as the start of a subsequent water addition.
    if(waterWaveFrame)cancelAnimationFrame(waterWaveFrame)
    waterWaveFrame=0
    // Portaling out of the scrollable app body prevents fixed sheets from
    // moving/clipping on iOS. The content behind the sheet stays frozen.
    activeOverlay?.remove()
    activeOverlay=null
    replace(root,[
      ...(view==='library'?library():view==='journal'?journal():view==='log'?logPage():view==='average'?averageDashboard():dashboard()),
      el('div.fn2__status',{role:'alert',dataset:{food2Status:'true'},text:errorMessage}),
    ])
    // Animate SVG-native wave geometry INSIDE the actual lifter paths.
    // Water updates immediately; only the paint moves over two seconds.
    const figure=root.querySelector('[data-water-goal-figure="true"]')
    if(figure){
      const wave=figure.querySelector('[data-water-wave-path="true"]')
      const percent=Number(figure.dataset.waterPercent)||0
      const from=paintedWaterPercent
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const started=performance.now()
      const duration=2000
      const animate=(now)=>{
        if(!wave?.isConnected||view!=='dashboard'){waterWaveFrame=0;return}
        const fraction=reduced?1:Math.min(1,Math.max(0,(now-started)/duration))
        const eased=1-Math.pow(1-fraction,3)
        paintedWaterPercent=from+(percent-from)*eased
        wave.setAttribute('d',waterWavePath(paintedWaterPercent,reduced?0:now/850))
        if(fraction<1)waterWaveFrame=requestAnimationFrame(animate)
        else {paintedWaterPercent=percent;waterWaveFrame=0}
      }
      // Don't run a constant background loop when water hasn't changed.
      if(reduced||Math.abs(from-percent)<0.01) {
        paintedWaterPercent=percent
        wave?.setAttribute('d',waterWavePath(percent))
      } else waterWaveFrame=requestAnimationFrame(animate)
    }
    if(sheet) {
      activeOverlay=overlay()
      document.body.append(activeOverlay)
      document.body.dataset.food2Modal='true'
    } else delete document.body.dataset.food2Modal
    if(sheet==='manual'||view==='log')mountRuntime()
  }
  async function refresh(){
    const date=selectedDate
    await load()
    if(date===selectedDate)render()
  }
  function deactivate(){
    clearError()
    if(waterWaveFrame)cancelAnimationFrame(waterWaveFrame)
    waterWaveFrame=0
    sheet='';picked=null;pickedDate=null;servingFood=null;servingAmount=1;view='dashboard'
    activeOverlay?.remove();activeOverlay=null
    delete document.body.dataset.food2Modal
  }
  return {root,refresh,deactivate}
}
