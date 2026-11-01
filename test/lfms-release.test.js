import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('LFMS is the visible brand while stable install identity and backup-compatible storage remain',()=>{
  const html=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest')),duo=JSON.parse(read('manifest-duo.webmanifest'))
  assert.match(html,/<title>Less Fat More Strong<\/title>/)
  assert.match(html,/content="LFMS"/)
  assert.match(html,/branding\/lfms\/logo-full\.svg/)
  assert.equal(manifest.name,'Less Fat More Strong')
  assert.equal(manifest.short_name,'LFMS')
  assert.equal(duo.name,'Less Fat More Strong Duo')
  assert.equal(duo.id,'./?layout=duo')
  assert.equal(duo.start_url,'./?layout=duo')
  assert.equal(manifest.start_url,'.')
  assert.match(read('native/ios/Tempered/Info.plist'),/<string>LFMS<\/string>/)
  assert.match(read('src/ui/screens/today.js'),/lfms__today-mark/)
  assert.match(read('src/ui/screens/fuel-next.js'),/lfms__fuel-mark/)
  assert.match(read('src/ui/screens/setup.js'),/lfms__setup-logo/)
  assert.match(read('src/ui/screens/settings.js'),/lfms__settings-logo/)
  assert.match(read('src/ui/app.js'),/get\('food2'\) !== '0'/)
  assert.match(read('src/ui/app.js'),/createFuelScreen/)
  assert.match(read('src/ui/app.js'),/createFuelNextScreen/)
  assert.match(read('src/pwa/register.js'),/serviceWorker|navigator/)
})
test('new and legacy icon binaries plus scalable logo exist',()=>{
  const logo=read('branding/lfms/logo-full.svg')
  assert.match(logo,/<svg/)
  assert.match(logo,/LESS FAT MORE STRONG|Less Fat More Strong/)
  for(const size of [180,512,1024]){
    const binary=readFileSync(new URL('../icons/icon-'+size+'.png',import.meta.url))
    const old=readFileSync(new URL('../branding/tempered-legacy/icon-'+size+'.png',import.meta.url))
    assert.equal(binary.toString('ascii',1,4),'PNG')
    assert.equal(binary.readUInt32BE(16),size)
    assert.equal(binary.readUInt32BE(20),size)
    assert.notDeepEqual(binary,old)
  }
})
test('Pages includes new asset families, service worker caches every runtime path',()=>{
 const pages=read('.github/workflows/pages.yml')
 assert.match(pages,/art\/food/)
 assert.match(pages,/branding\/lfms/)
 const sw=read('sw.js')
 assert.match(sw,/'\.\/src\/brand\.css'/)
 assert.match(sw,/'\.\/branding\/lfms\/logo-full\.svg'/)
 for(const size of [180,512,1024]) assert.match(sw,new RegExp("'\\./icons/icon-"+size+"\\.png'"))
 assert.match(read('src/version.js'),/export const VERSION = '0\.\\d+\.\\d+ \\(\\d+\\)'/)
})
