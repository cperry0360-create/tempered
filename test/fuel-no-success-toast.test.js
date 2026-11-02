import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fuel=readFileSync(new URL('../src/ui/screens/fuel-next.js',import.meta.url),'utf8')
const style=readFileSync(new URL('../src/food-next.css',import.meta.url),'utf8')

test('successful meal logging does not leave a banner across Fuel cards',()=>{
  const logging=fuel.slice(fuel.indexOf('  async function logServing()'),fuel.indexOf('  function libraryRows()'))
  assert.match(logging,/await daily\.addNutrition\(clock\.today\(\)/)
  assert.match(logging,/await refresh\(\)/)
  assert.match(logging,/clearError\(\)/)
  assert.doesNotMatch(logging,/Logged .*serving/)
  assert.doesNotMatch(logging,/notify\(/)
})

test('success actions are silent; Undo remains available in Meal History',()=>{
  assert.doesNotMatch(fuel,/notify\(/)
  assert.doesNotMatch(fuel,/Meal photo saved locally|Photo removed from this meal|Meal deleted; Undo is available/)
  assert.match(fuel,/undo\?\.date===journalDate&&el\('button\.fn2__undo'/)
})

test('genuine failures are accessible, temporary, and cleared on navigation',()=>{
  assert.match(fuel,/function showError\(text\)/)
  assert.match(fuel,/errorTimer=setTimeout\(\(\)=>\{/)
  assert.match(fuel,/},4500\)/)
  assert.match(fuel,/role:'alert',dataset:\{food2Status:'true'\},text:errorMessage/)
  assert.match(fuel,/function go\(name\)\{clearError\(\)/)
  assert.match(fuel,/function deactivate\(\)\{\s*clearError\(\)/)
  assert.match(fuel,/showError\('Could not remove photo'\)/)
  assert.match(fuel,/showError\('Could not delete meal'\)/)
  assert.match(style,/\.fn2__status:not\(:empty\) \{display:block\}/)
})
