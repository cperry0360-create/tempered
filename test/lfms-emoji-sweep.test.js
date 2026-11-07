import test from 'node:test'
import assert from 'node:assert/strict'
import { startEmojiSweep } from '../src/ui/lfms-emoji-sweep.js'

test('each launch gets fresh playback; cleanup releases its image and blob URL', async () => {
  const originals = {window:globalThis.window,Image:globalThis.Image,fetch:globalThis.fetch,create:URL.createObjectURL,revoke:URL.revokeObjectURL}
  const images=[],revoked=[];let sequence=0,calls=0,reduced=false
  globalThis.window={matchMedia:()=>({matches:reduced})}
  globalThis.Image=class {remove(){this.removed=true}}
  globalThis.fetch=async()=>{calls++;return {ok:true,blob:async()=>new Blob(['asset'])}}
  URL.createObjectURL=()=>`blob:launch-${++sequence}`
  URL.revokeObjectURL=url=>revoked.push(url)
  const launch={isConnected:true,querySelector:()=>({append:image=>images.push(image)})}
  try {
    const first=await startEmojiSweep(launch,{delay:0})
    const second=await startEmojiSweep(launch,{delay:0})
    assert.equal(calls,2)
    assert.notEqual(images[0].src,images[1].src)
    first();first();second()
    assert.deepEqual(revoked,['blob:launch-1','blob:launch-2'])
    assert.ok(images.every(image=>image.removed))
    reduced=true
    await startEmojiSweep(launch,{delay:0})
    assert.equal(calls,2,'reduced motion never fetches the animation')
    reduced=false
    globalThis.fetch=async()=>{throw Error('offline cache miss')}
    await assert.doesNotReject(startEmojiSweep(launch,{delay:0}))
    assert.equal(images.length,2,'a missing asset leaves the brand fallback intact')
  } finally {
    globalThis.window=originals.window;globalThis.Image=originals.Image;globalThis.fetch=originals.fetch
    URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke
  }
})
