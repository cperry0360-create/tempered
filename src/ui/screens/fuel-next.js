/**
 * Approved Food 2.0 candidate, isolated behind ?food2=1.
 * Actual totals and saved foods use Tempered's canonical stores.
 * Stock photos are illustration only, with guaranteed offline fallbacks.
 */
import { nutritionLedger, nutritionMacroTargets, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { FOOD_PHOTOS, matchingFoodPhoto } from '../food-photos.js'
import { compressMealPhoto } from '../meal-photo.js'

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
  let data=null, prefs={},view='dashboard',sheet='',filter='all',query='',picked=null, journalDate=clock.today()
  let working=false, undo=null, cart=new Map(), status='', pickedDate=null
  let activeOverlay=null
  const runtime=el('div.fn2__legacy-runtime')

  const updated = event => {if(root.isConnected&&(!event?.detail?.date||event.detail.date===clock.today()))refresh().catch(console.error)}
  window.addEventListener('tempered:fuel-updated',updated)
  window.addEventListener('tempered:nutrition-review-changed',updated)

  async function load() {
    const [days,now,profile]=await Promise.all([storage.getAll('dayLogs'),daily.forDate(clock.today()),storage.get('profile','profile')])
    data={days,now,day:days.find(x=>x.date===clock.today())??{date:clock.today()},foods:foodLibrary(days,4)}
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
  function notify(text){status=text;const node=root.querySelector('[data-food2-notice]');if(node)node.textContent=text}
  async function savePrefs(values) {
    const profile=(await storage.get('profile','profile'))??{id:'profile'}
    await storage.put('profile',{...profile,...values})
    prefs={...profile,...values}
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
      detail:{ trigger, date:clock.today(), focus:'history' },
    }))
  }
  function heading(){
    return el('div.fn2__heading',{},[
      el('div.fn2__brand',{},[el('img.lfms__fuel-mark',{src:new URL('../../../branding/lfms/logo-mark.svg',import.meta.url).href,alt:'',loading:'eager'}),el('b',{text:'LFMS'}),el('small',{text:' / FUEL'})]),
      el('nav.fn2__pills',{'aria-label':'Food shortcuts'},[
        el('button',{type:'button',onclick:()=>go('library')},[icon('search'),' Food Library']),
        el('button',{type:'button',onclick:()=>openSheet('quick')},[icon('plus'),' Quick Log']),
        el('button',{type:'button',onclick:()=>go('journal')},[icon('journal'),' Meal History']),
      ]),
    ])
  }
  function ring(cal,protein) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg')
    svg.setAttribute('viewBox','0 0 160 160')
    svg.setAttribute('role','img')
    svg.setAttribute('aria-label','Calories '+Math.round(cal)+'%, protein '+Math.round(protein)+'% of goals')
    for(const [radius,type,percent] of [[69,'cal',cal],[47,'protein',protein]]) {
      for(const track of [true,false]){
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle')
        const perimeter=2*Math.PI*radius
        for(const [k,v] of Object.entries({cx:80,cy:80,r:radius,fill:'none',class:'fn2__ring-'+type+(track?' fn2__track':''),
          'stroke-width':track?9:11,transform:'rotate(-90 80 80)',...(track?{}:{'stroke-dasharray':perimeter,'stroke-dashoffset':perimeter*(1-percent/100)})}))c.setAttribute(k,String(v))
        svg.append(c)
      }
    }
    return el('div.fn2__rings',{},[svg])
  }
  function metric(label,amount,goal,unit,extra='') {
    return el('div.fn2__metric'+extra,{},[
      el('small',{text:Math.round(pct(amount,goal))+'% of target'}),
      el('strong',{text:fmt(amount)}),
      el('span',{text:label}),
      el('small.fn2__metric-goal',{text:'Target: '+fmt(goal)+' '+unit}),
    ])
  }
  function macro(name,amount,goal) {
    return el('div.fn2__macro',{},[
      el('span',{text:name}),
      el('div.fn2__macro-track',{role:'progressbar','aria-label':name+' progress','aria-valuenow':String(amount),'aria-valuemin':'0','aria-valuemax':String(goal)},[
        el('i',{style:'width:'+pct(amount,goal)+'%'}),
      ]),
      el('small',{text:fmt(amount)+'g / '+fmt(goal)+'g'}),
    ])
  }
  function week() {
    const today=clock.today(),date=new Date(today+'T12:00:00Z')
    date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7)
    return el('div.fn2__week',{},Array.from({length:7},(_,i)=>{
      const d=new Date(date);d.setUTCDate(date.getUTCDate()+i)
      const iso=d.toISOString().slice(0,10)
      const record=data.days.find(x=>x.date===iso)
      return el('button',{type:'button',disabled:iso>today,dataset:{today:String(iso===today)},onclick:()=>window.dispatchEvent(new CustomEvent('tempered:open-nutrition',{detail:{date:iso}}))},[
        el('small',{text:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}),
        el('b',{text:String(d.getUTCDate())}),
        el('i',{text:record?.nutritionStatus==='complete'?'✓':record?.nutritionLogged?'◐':'·'}),
      ])
    }))
  }
  function dashboard() {
    const day=data.day,ledger=nutritionLedger(day)
    const calories=n(day.calories),protein=n(day.proteinGrams),calGoal=target('calories_logged',2100),proGoal=target('protein_target',135)
    const macros=nutritionMacroTargets(calGoal,proGoal)
    const lastWeight=[...data.days].filter(x=>x.date<=clock.today()&&n(x.bodyMetrics?.weight)>0)
      .sort((a,b)=>b.date.localeCompare(a.date))[0]?.bodyMetrics?.weight
    return [
      heading(),week(),
      el('section.fn2__hero',{'aria-label':'Live nutrition totals'},[
        el('div.fn2__metrics',{},[
          metric('Calories Consumed',calories,calGoal,'kcal'),
          metric('Protein Consumed',protein,proGoal,'g',' fn2__metric--protein'),
        ]),
        ring(pct(calories,calGoal),pct(protein,proGoal)),
        el('div.fn2__macros',{},[
          macro('Carbs',ledger.totals.carbs,macros.carbs),
          macro('Fat',ledger.totals.fat,macros.fat),
          macro('Fiber',ledger.totals.fiber,macros.fiber),
        ]),
      ]),
      el('div.fn2__inline-actions',{},[
        el('button',{type:'button',onclick:event=>openFullHistory(event.currentTarget)},['Track other nutrients ›']),
        el('button',{type:'button',dataset:{diaryFinishToday:'true'},onclick:async()=>{
          await daily.setNutritionStatus(clock.today(),day.nutritionStatus==='complete'?'partial':'complete')
          await refresh()
        }},[day.nutritionStatus==='complete'?'✓ Day closed · Reopen':'Close day']),
      ]),
      el('div.fn2__stats',{},[
        el('section.fn2__stat',{},[
          el('h2',{},[icon('body'),' Weight']),
          el('strong',{text:lastWeight?Number(lastWeight).toFixed(1)+' lb':'—'}),
          el('small',{text:lastWeight?'Latest logged':'Not logged'}),
        ]),
        el('section.fn2__stat',{},[
          el('h2',{},[icon('water'),' Water']),
          el('strong',{text:fmt(day.waterOz)+' oz'}),
          el('small',{text:'of '+fmt(target('water',120))+' oz goal'}),
          el('div.fn2__water-actions',{},[8,12,25].map(a=>el('button',{type:'button',onclick:async()=>{await daily.logAt(clock.today(),'water',a);await refresh()}},['+'+a]))),
        ]),
        el('section.fn2__stat',{},[
          el('h2',{},[icon('steps'),' Steps']),
          el('strong',{text:Number.isFinite(day.steps)?fmt(day.steps):'—'}),
          el('small',{text:Number.isFinite(day.steps)?'Today':'Not logged'}),
        ]),
      ]),
      macroJournal(day),
      el('button.fn2__float',{type:'button',dataset:{food2Add:'true'},onclick:()=>openSheet('quick'),'aria-label':'Log food'},['+']),
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
          onclick:()=>openSheet('quick')},['+']),
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
        el('button',{type:'button',onclick:()=>{journalDate=clock.today();go('journal')}},['More ', '›']),
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
      notify('Meal photo saved locally. It will be included in your backup.')
    } catch(error) {
      const message=error instanceof Error?error.message:'Could not read that photo'
      notify(message)
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
      notify('Photo removed from this meal.')
    } catch { notify('Could not remove photo') }
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
      notify('Meal deleted; Undo is available.')
    }catch{notify('Could not delete meal')}finally{working=false}
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
    return [
      heading(),
      el('div.fn2__title',{},[el('h1',{text:'Meal History'}),el('button',{type:'button',onclick:()=>go('dashboard')},['Back to Fuel'])]),
      el('nav.fn2__history-nav',{'aria-label':'Browse meal history by date'},[
        el('button.fn2__history-arrow',{type:'button','aria-label':'Previous day',onclick:()=>shiftJournalDate(-1)},['‹']),
        el('label.fn2__history-date',{},[
          el('span',{text:'Viewing date'}),
          el('input',{type:'date',value:journalDate,max:clock.today(),'aria-label':'Meal history date',
            onchange:event=>setJournalDate(event.target.value)}),
        ]),
        el('button.fn2__history-arrow',{type:'button','aria-label':'Next day',disabled:isToday,onclick:()=>shiftJournalDate(1)},['›']),
        el('button.fn2__history-today',{type:'button',disabled:isToday,onclick:()=>setJournalDate(clock.today())},['Today']),
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
  const servingChoices=Array.from({length:20},(_,i)=>(i+1)/4)
  const portionLabel=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:2})
  function cartTotals() {
    let servings=0,kcal=0,protein=0
    for(const {food,count} of cart.values()){servings+=count;kcal+=n(food.calories)*count;protein+=n(food.proteinGrams)*count}
    return {servings:Math.round(servings*100)/100,kcal,protein}
  }
  function stage(food,delta=1) {
    const clean=repeatableFood(food)
    const id=foodKey(clean),old=cart.get(id)
    const count=Math.max(0,Math.min(5,Math.round(((old?.count??0)+delta)*4)/4))
    if(count===0)cart.delete(id)
    else cart.set(id,{food:clean,count})
    render()
  }
  function setCartPortion(id,count) {
    const row=cart.get(id),value=Number(count)
    if(!row||!servingChoices.includes(value))return
    cart.set(id,{...row,count:value})
    render()
  }
  function cartContents() {
    const totals=cartTotals()
    return [
      ...[...cart.entries()].map(([id,{food,count}])=>el('div.fn2__cart-row',{},[
        el('span',{text:food.description}),
        el('label.fn2__servings',{},[
          el('span',{text:'Servings'}),
          el('select',{'aria-label':'Portion for '+food.description,
            onchange:event=>setCartPortion(id,event.target.value)},
            servingChoices.map(value=>el('option',{value:String(value),selected:value===count,text:portionLabel(value)}))),
        ]),
        el('strong',{text:fmt(n(food.calories)*count)+' kcal'}),
        el('button',{type:'button','aria-label':'Remove '+food.description,onclick:()=>{cart.delete(id);render()}},['×']),
      ])),
      !cart.size&&el('p',{text:'Choose foods to add. Nothing is logged yet.'}),
      el('strong.fn2__cart-total',{text:fmt(totals.kcal)+' kcal · '+fmt(totals.protein)+'g protein'}),
      el('button.fn2__primary',{type:'button',disabled:!totals.servings||working,onclick:commitCart},
        ['Log '+portionLabel(totals.servings)+' serving'+(totals.servings===1?'':'s')]),
    ]
  }
  async function commitCart(){
    if(working||!cart.size)return
    working=true
    try{
      while(cart.size){
        const [id,item]=cart.entries().next().value
        const {count,lastLoggedAt,loggedAt,id:entryId,source,...values}=item.food
        await daily.addNutrition(clock.today(),{...values,portion:count})
        cart.delete(id)
      }
      sheet='';view='dashboard'
      await refresh()
      window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
      notify('Logged saved foods.')
    }catch{render();notify('One or more foods were not saved. Remaining items are still in the cart.')}
    finally{working=false}
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
      el('button.fn2__add',{type:'button','aria-label':'Stage '+food.description,onclick:()=>stage(food)},['+']),
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
  function library() {
    const results=el('div.fn2__food-results',{},libraryRows())
    return [
      heading(),
      el('div.fn2__title',{},[el('h1',{text:'Food Library'}),el('button',{type:'button',onclick:()=>go('dashboard')},['Back to Fuel'])]),
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
        el('aside.fn2__cart',{},[
          el('h2',{text:'Log Cart'}),
          ...cartContents(),
          el('button.fn2__secondary',{type:'button',onclick:()=>openSheet('manual')},['Manual entry, photo or import']),
          el('small',{text:'Photos are illustrative. Values come only from saved foods.'}),
        ]),
      ]),
    ]
  }
  function mountRuntime(){
    runtime.dataset.date=clock.today()
    window.dispatchEvent(new CustomEvent('tempered:mount-nutrition-panel',{detail:{slot:runtime,date:clock.today()}}))
  }
  function overlay(){
    const title={quick:'Quick Log',cart:'Review servings',manual:'Quick Log',photo:'Choose illustration',actions:'Meal actions','attach-photo':'Meal photo'}[sheet]
    const content=sheet==='quick'?[
      el('p.fn2__caption',{text:'Tap a previously logged food, then confirm the cart.'}),
      ...data.foods.top.map(food=>el('button.fn2__quick-food',{type:'button',onclick:()=>{stage(food);openSheet('cart')}},[
        thumbnail(food),el('span',{text:food.description}),el('strong',{text:fmt(food.calories)+' kcal'}),icon('plus'),
      ])),
      el('button.fn2__secondary',{type:'button',onclick:()=>go('library')},['Browse all saved foods']),
      el('button.fn2__primary',{type:'button',onclick:()=>openSheet('manual')},['Manual entry · Meal photo · Import nutrition']),
    ]:sheet==='cart'?[
      el('p.fn2__caption',{text:'Choose how much you ate. Totals update before you log.'}),
      ...cartContents(),
      el('button.fn2__secondary',{type:'button',onclick:()=>go('library')},['Browse Food Library']),
    ]:sheet==='photo'?[
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
      el('button.fn2__secondary',{type:'button',onclick:()=>{const x=repeatableFood(picked);picked=null;stage(x);openSheet('cart')}},['Log this meal again']),
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
  function closeSheet() {sheet='';picked=null;pickedDate=null;render()}
  function go(name){view=name;sheet='';picked=null;pickedDate=null;render()}
  function render() {
    if(!data)return
    // Portaling out of the scrollable app body prevents fixed sheets from
    // moving/clipping on iOS. The content behind the sheet stays frozen.
    activeOverlay?.remove()
    activeOverlay=null
    replace(root,[
      ...(view==='library'?library():view==='journal'?journal():dashboard()),
      el('div.fn2__status',{role:'status',dataset:{food2Status:'true'},text:status}),
    ])
    if(sheet) {
      activeOverlay=overlay()
      document.body.append(activeOverlay)
      document.body.dataset.food2Modal='true'
    } else delete document.body.dataset.food2Modal
    if(sheet==='manual')mountRuntime()
  }
  async function refresh(){await load();render()}
  function deactivate(){
    sheet='';picked=null;pickedDate=null;view='dashboard'
    activeOverlay?.remove();activeOverlay=null
    delete document.body.dataset.food2Modal
  }
  return {root,refresh,deactivate}
}
