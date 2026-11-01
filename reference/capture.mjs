import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const delay = ms => new Promise(done => setTimeout(done, ms))
const chrome = ['/usr/bin/chromium','/usr/bin/google-chrome','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync)
if (!chrome) throw new Error('No Chrome executable found')
const profile = await mkdtemp(join(tmpdir(),'forged-reference-'))
const outdir = resolve('reference/visual-evidence')
await mkdir(outdir,{recursive:true})
const url = pathToFileURL(resolve('reference/forged-nutrition.html')).href
const proc = spawn(chrome,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--no-default-browser-check','--hide-scrollbars',
  '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
  '--user-data-dir='+profile,'about:blank',
],{stdio:['ignore','ignore','pipe']})
let stderr=''
proc.stderr.on('data',chunk=>{stderr+=chunk})
const marker=join(profile,'DevToolsActivePort')
let port=0
for(let i=0;i<160;i++){
  try {
    port=Number((await readFile(marker,'utf8')).split(/\r?\n/)[0])
    if(port>0)break
  } catch {}
  await delay(100)
}
if(!port)throw new Error('Chrome could not expose DevTools port: '+stderr.slice(-2000))
let pageUrl=null
for(let i=0;i<160;i++){
  try{
    const targets=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())
    pageUrl=targets.find(t=>t.type==='page')?.webSocketDebuggerUrl
    if(pageUrl)break
  }catch{}
  await delay(100)
}
if(!pageUrl)throw new Error('Chrome did not expose a page: '+stderr.slice(-2000))
const ws=new WebSocket(pageUrl)
await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true})
  ws.addEventListener('error',()=>reject(new Error('CDP WebSocket failed')),{once:true})
})
let seq=0
const waiting=new Map()
ws.addEventListener('message',evt=>{
  const message=JSON.parse(String(evt.data))
  const req=waiting.get(message.id)
  if(!req)return
  waiting.delete(message.id)
  if(message.error)req.reject(new Error(message.error.message))
  else req.resolve(message.result)
})
function call(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq
    waiting.set(id,{resolve,reject})
    ws.send(JSON.stringify({id,method,params}))
  })
}
try{
  await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride',{width:726,height:512,deviceScaleFactor:1,mobile:false,screenWidth:726,screenHeight:512})
  for(const view of ['dashboard','journal','quicklog','library','tempered-fuel','tempered-journal','tempered-journal-menu']){
    const target=view==='tempered-fuel' ? pathToFileURL(resolve('reference/tempered-fuel-study.html')).href
      : view==='tempered-journal' ? pathToFileURL(resolve('reference/tempered-journal-study.html')).href
      : view==='tempered-journal-menu' ? pathToFileURL(resolve('reference/tempered-journal-study.html')).href+'?view=menu'
      : url+'?view='+view
    await call('Page.navigate',{url:target})
    await delay(850)
    const result=await call('Runtime.evaluate',{expression:"JSON.stringify({state:document.querySelector('#journal')?.className,modal:document.querySelector('#modal')?.className,images:document.images.length,ok:document.querySelector('.screen')?.getBoundingClientRect()?.width === 726})",returnByValue:true})
    console.log(view,result?.result?.value)
    if(view==='tempered-fuel'){
      const check=await call('Runtime.evaluate',{expression:"JSON.stringify({brand:document.querySelector('.mark')?.textContent,rail:document.querySelectorAll('.rail button').length,selected:document.querySelector('.rail [aria-current=page]')?.getAttribute('data-section'),hero:!!document.querySelector('.donut'),macros:document.querySelectorAll('.macro').length,stats:document.querySelectorAll('.stat').length})",returnByValue:true})
      const state=JSON.parse(check.result.value)
      console.log('Tempered fidelity assertion',state)
      if(!state.brand?.includes('TEMPERED')||state.rail!==4||state.selected!=='food'||!state.hero||state.macros!==3||state.stats!==3)
        throw new Error('Tempered visual design geometry is incomplete: '+JSON.stringify(state))
    }
    if(view.startsWith('tempered-journal')){
      const check=await call('Runtime.evaluate',{expression:"JSON.stringify({title:document.querySelector('.journal-title h2')?.textContent,rail:document.querySelectorAll('.rail button').length,active:document.querySelector('.rail [aria-current=page]')?.getAttribute('data-section'),entries:document.querySelectorAll('.journal-entry').length,menu:document.querySelector('#meal-menu')?.classList.contains('open')})",returnByValue:true})
      const state=JSON.parse(check.result.value)
      console.log('Tempered journal fidelity assertion',state)
      if(state.title!=='Food Journal'||state.rail!==4||state.active!=='food'||state.entries<2||(view==='tempered-journal-menu' && !state.menu))
        throw new Error('Tempered journal visual study incomplete '+JSON.stringify(state))
    }
    const snap=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
    const bytes=Buffer.from(snap.data,'base64')
    const dest=join(outdir,view+'.png')
    await writeFile(dest,bytes)
    console.log('Saved',dest,bytes.length)
  }
}finally{
  ws.close()
  proc.kill('SIGTERM')
  // Chromium may still be releasing profile files after SIGTERM.
  // Cleanup failure must not invalidate fully verified captures.
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150}).catch(error => console.warn('Non-fatal Chromium profile cleanup:',error.code))
}
