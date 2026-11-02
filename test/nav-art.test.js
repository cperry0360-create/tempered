import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const js = readFileSync(new URL('../src/ui/icons.js', import.meta.url), 'utf8')
for (const key of ['today','train','fuel','progress']) {
  test('custom silhouette nav icon and reusable SVG exist: '+key, () => {
    const svg=readFileSync(new URL('../src/rail-icons/'+key+'.svg', import.meta.url), 'utf8')
    assert.match(svg,/viewBox="0 0 24 24"/)
    assert.match(svg,/fill-rule="evenodd"/)
    assert.match(js,new RegExp("'nav-"+key+"': \\[\\['silhouette'"))
    const d=svg.match(/ d="([^"]+)"/)?.[1]
    assert.ok(d?.startsWith('M'), 'SVG needs path data')
    assert.ok(js.includes(d), 'App must use the same silhouette as the source asset')
  })
}
test('silhouette renderer uses fill and preserves cutouts', () => {
  assert.match(js,/kind === 'silhouette'/)
  assert.match(js,/setAttribute\('fill-rule', 'evenodd'\)/)
})
