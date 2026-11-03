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
  assert.match(css,/--lfms-barbell-home-x:min\(72%,calc\(100vw - 86px\)\)/)
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
    ['bottom-red','78%'],['bottom-white','71%'],['bottom-blue','64%'],
    ['top-red','25%'],['top-white','18%'],['top-blue','11%'],
  ])assert.ok(css.includes('lfms-launch__plate--'+which+' {top:'+top),which)
  assert.deepEqual(bottoms,[1330,1640,1950])
  assert.deepEqual(tops,[3070,3370,3670])
  assert.match(css,/animation:lfms-barbell-drop 620ms cubic-bezier\(\.18,\.75,\.26,1\) 2390ms both/)
  assert.ok(bottoms[2]+430 < 2390,'bottom stack finishes before the bar falls')
  assert.ok(2390+620 < tops[0],'bar finishes before the top side loads')
  assert.ok(tops[2]+410 < 4390,'sixth plate settles before peel')
  assert.match(css,/@keyframes lfms-barbell-drop[\s\S]*?translateY\(-112vh\)/)
  assert.match(js,/LFMS_PLATES_SETTLED_MS = 4390/)
  assert.match(js,/LFMS_ZIPPER_DURATION_MS = 1160/)
})

test('loaded barbell tips toward lower right and tears into an already-visible app',()=>{
  const html=read('index.html'),css=read('src/brand.css')
  const finish=read('src/lfms-finish.css'),js=read('src/main.js')
  assert.match(html,/class="lfms-launch__tear-edge"/)
  assert.match(css,/\.lfms-launch\[data-revealing="true"\]/)
  assert.match(css,/animation:lfms-zipper-peel 1160ms cubic-bezier/)
  assert.match(css,/animation:lfms-loaded-scrape 1160ms cubic-bezier/)
  assert.match(css,/animation:lfms-tear-follow 1160ms cubic-bezier/)
  assert.match(css,/@keyframes lfms-loaded-scrape[\s\S]*?top:125%;transform:[^\n]*rotate\(125deg\)/)
  assert.match(css,/@keyframes lfms-zipper-peel[\s\S]*?clip-path:polygon\(102%/)
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
  assert.match(css,/\.lfms-launch\[data-revealing="true"\] \{animation:none;clip-path:none\}/)
  assert.match(css,/\.lfms-launch__tear-edge \{display:none\}/)
  assert.match(js,/if \(reduced\) \{[\s\S]*?launch\.dataset\.closing = 'true'/)
})
