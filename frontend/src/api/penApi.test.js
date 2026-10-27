import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map([['beefcare:latency', '0']])
global.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

test('pen edits use the shared pens collection and refresh cattle acceptance aliases', async () => {
  const [{ penApi }, { pens }] = await Promise.all([import('./penApi.js'), import('./herdDomainApi.js')])
  const before = await pens.get('A1')

  await penApi.update({ ...before, minAge: 15, minWeight: 260, accept: 'Sinh sản nâng cao' })

  const updated = await pens.get('A1')
  assert.equal(updated.minMonths, 15)
  assert.equal(updated.minKg, 260)
  assert.equal(updated.tag, 'Sinh sản nâng cao')
})
