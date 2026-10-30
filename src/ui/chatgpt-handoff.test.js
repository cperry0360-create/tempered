import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handoffChatGptPrompt } from './chatgpt-handoff.js'

test('ChatGPT handoff shares without replacing the app or copying', async () => {
  let payload
  const result = await handoffChatGptPrompt('test photo prompt', {
    share: async (data) => { payload = data },
    copy: () => { throw new Error('copy must not run when share succeeds') },
  })
  assert.equal(result, 'shared')
  assert.equal(payload.text, 'test photo prompt')
})
test('canceled or unavailable share uses clipboard instead of a browser link', async () => {
  let copied
  const options = { share: async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }) },
    copy: async (value) => { copied = value; return true } }
  assert.equal(await handoffChatGptPrompt('health prompt', options), 'copied')
  assert.equal(copied, 'health prompt')
  assert.equal(await handoffChatGptPrompt('offline prompt', {share: null,copy: options.copy}), 'copied')
  assert.equal(copied, 'offline prompt')
})
test('blocked share and clipboard surfaces an actionable error instead of navigating', async () => {
  await assert.rejects(handoffChatGptPrompt('prompt', {
    share: async () => { throw new Error('no share') },
    copy: async () => false,
  }), /Could not copy/)
})
