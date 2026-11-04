import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('approved LFMS logo and two lettering swoops stay unchanged',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  assert.match(html,/lfms-launch__mark" src="\.\/branding\/lfms\/logo-mark\.svg"/)
  assert.match(html,/lfms-launch__wordmark--less" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(html,/lfms-launch__wordmark--strong" src="\.\/branding\/lfms\/logo-wordmark\.svg"/)
  assert.match(css,/lfms-wordmark-enter-left 1080ms cubic-bezier\(\.17,\.91,\.29,1\) 80ms both/)
  assert.match(css,/lfms-wordmark-enter-right 1130ms cubic-bezier\(\.17,\.91,\.29,1\) 190ms both/)
  assert.match(css,/lfms-logo-settle 630ms cubic-bezier/)
  assert.doesNotMatch(html,/lfms-launch__glass-phase|lfms-launch__cracks|lfms-launch__impact-flash/)
  assert.doesNotMatch(html,/lfms-launch__dumbbell-stage|lfms-db-shaft|lfms-db-grip/)
})

test('six flat, cartoon bumper plates use red WHITE blue in identical order on both sides',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  const expected=[
    ['bottom','red','#F03725'],['bottom','white','#F5F9FF'],['bottom','blue','#359DF3'],
    ['top','red','#F03725'],['top','white','#F5F9FF'],['top','blue','#359DF3'],
  ]
  assert.match(html,/class="lfms-launch__barbell-stage"/)
  assert.match(html,/class="lfms-launch__bar-art"/)
  assert.equal((html.match(/class="lfms-launch__plate lfms-launch__plate--/g)||[]).length,6)
  let last=-1
  for(const [side,color,fill] of expected){
    const token='class="lfms-launch__plate lfms-launch__plate--'+side+'-'+color+'"'
    const idx=html.indexOf(token)
    assert.ok(idx>last,'plate order '+side+' '+color)
    last=idx
    assert.ok(html.slice(idx,idx+240).includes('data-color="'+color+'"'))
    assert.ok(html.slice(idx,idx+530).includes('fill="'+fill+'"'),side+' '+color+' uses grounded color '+fill)
    assert.ok(css.includes('.lfms-launch__plate--'+side+'-'+color),'animation selector '+side+' '+color)
  }
  assert.doesNotMatch(html,/linearGradient|url\(#lfms-db-|lfms-db-shaft/)
  assert.match(css,/@keyframes lfms-bumper-stack/)
  assert.match(css,/--lfms-barbell-home-x:85vw/)
  assert.match(html,/viewBox="0 0 160 700"/)
  assert.match(html,/rect x="74" y="15" width="12" height="670"/)
  assert.match(html,/rect x="69" y="269" width="22" height="162"/)
  assert.match(css,/aspect-ratio:160 \/ 700/)
  assert.match(css,/height:8\.857%/)
  assert.match(css,/lfms-brand-clear-side 520ms/)
  assert.match(css,/--lfms-brand-scale:\.65/)
  assert.match(css,/--lfms-barbell-home-x:calc\(100vw - 46px\)/)
})

test('bottom red/white/blue land before the VERTICAL bar, then top red/white/blue stack',()=>{
  const css=read('src/brand.css'),js=read('src/main.js')
  const delay=selector=>{
    const start=css.indexOf('.lfms-launch__plate--'+selector+' {')
    assert.ok(start>=0,selector)
    const rule=css.slice(start,css.indexOf('}',start))
    const m=rule.match(/(\d+)ms both/)
    assert.ok(m,'missing delay '+selector)
    return Number(m[1])
  }
  const bottoms=['bottom-red','bottom-white','bottom-blue'].map(delay)
  const tops=['top-red','top-white','top-blue'].map(delay)
  // Leave the central knurled handle exposed, not covered by giant discs.
  for(const [which,top] of [
    ['bottom-red','87%'],['bottom-white','81%'],['bottom-blue','75%'],
    ['top-red','20%'],['top-white','14%'],['top-blue','8%'],
  ])assert.ok(css.includes('lfms-launch__plate--'+which+' {top:'+top),which)
  assert.deepEqual(bottoms,[1250,1510,1770])
  assert.deepEqual(tops,[2880,3160,3440])
  assert.match(css,/animation:lfms-barbell-drop 530ms linear 2280ms both/)
  assert.ok(bottoms[2]+395 < 2280,'bottom stack finishes before the bar falls')
  assert.ok(2280+530 < tops[0],'bar finishes before the top side loads')
  assert.ok(tops[2]+380 < 3990,'sixth plate settles before peel')
  assert.match(css,/@keyframes lfms-barbell-drop[\s\S]*?translateY\(-72vh\)/)
  assert.match(js,/LFMS_PLATES_SETTLED_MS = 3990/)
  assert.match(js,/LFMS_PEEL_DURATION_MS = 1020/)
})

test('attached corner fold replaces loose white wire and paper triangle',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  assert.match(html,/class="lfms-launch__skin"/)
  assert.match(html,/class="lfms-launch__lift-tab"/)
  assert.doesNotMatch(html,/lfms-launch__tear-edge|lfms-launch__peel-flap/)
  assert.doesNotMatch(css,/lfms-tear-follow|lfms-peel-flap|lfms-launch__tear-edge|lfms-launch__peel-flap/)
  assert.doesNotMatch(css,/\.lfms-launch__barbell-stage::before\s*\{/)
  assert.match(css,/@keyframes lfms-curl-release/)
  assert.match(css,/\.lfms-launch\[data-revealing="true"\] \.lfms-launch__lift-tab\s*\{/)
  assert.match(css,/@keyframes lfms-bumper-stack[\s\S]*?translateY\(-69vh\)/)
  const plateFrames=css.slice(css.indexOf('@keyframes lfms-bumper-stack'),css.indexOf('@keyframes lfms-corner-peel'))
  assert.doesNotMatch(plateFrames,/rotate\(/)
})

test('polished barbell draws a unified right-corner peel onto the real app',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  const finish=read('src/lfms-finish.css'),js=read('src/main.js')
  assert.ok(html.indexOf('<!-- /lfms-launch__skin -->')<html.indexOf('class="lfms-launch__barbell-stage"'))
  assert.match(css,/\.lfms-launch\[data-revealing="true"\] \.lfms-launch__skin/)
  assert.match(css,/animation:lfms-corner-peel 1020ms cubic-bezier/)
  assert.match(css,/animation:lfms-loaded-scrape 1020ms cubic-bezier/)
  assert.match(css,/animation:lfms-curl-release 1020ms linear both/)
  assert.match(css,/@keyframes lfms-corner-peel[\s\S]*?88% 0%[\s\S]*?0% 100%/)
  assert.match(css,/@keyframes lfms-loaded-scrape[\s\S]*?top:164%;transform:[^\n]*rotate\(170deg\)/)
  assert.match(css,/\.lfms-launch \{\s*inset:0;width:100%;height:100%;min-width:0;\s*background:transparent;box-shadow:none;/)
  assert.match(finish,/html\[data-layout="duo"\]:has\(\.lfms-launch\[data-revealing="true"\]\) #app\.app/)
  assert.match(js,/launch\.dataset\.revealing = 'true'/)
  assert.match(js,/await dismissSplash\(\)/)
  assert.ok(js.indexOf('await dismissSplash()')<js.indexOf('await installWeeklyRecapRuntime(context)'))
  assert.match(js,/setTimeout\(dismissSplash, 8000\)/)
})

test('reduced motion skips falling/tear while showing complete barbell',()=>{
  const css=read('src/brand.css'),js=read('src/main.js')
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css,/\.lfms-launch__bar-art,\.lfms-launch__plate \{transform:none\}/)
  assert.match(css,/\.lfms-launch\[data-revealing="true"\] \.lfms-launch__skin \{animation:none;clip-path:none\}/)
  assert.match(css,/\.lfms-launch__lift-tab \{display:none\}/)
  assert.match(js,/if \(reduced\) \{[\s\S]*?launch\.dataset\.closing = 'true'/)
})
