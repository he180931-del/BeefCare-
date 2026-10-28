import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './testUtils'

global.localStorage = new MemoryStorage({ 'beefcare:latency': '0' })

test('pen edits use the shared pens collection and refresh cattle acceptance aliases', async () => {
  const [{ penApi }, { pens }] = await Promise.all([import('./penApi'), import('./herdDomainApi')])
  const before = await pens.get('A1')

  await penApi.update({ ...before, minAge: 15, minWeight: 260, accept: 'Sinh sản nâng cao' })

  const updated = await pens.get('A1')
  assert.equal(updated.minMonths, 15)
  assert.equal(updated.minKg, 260)
  assert.equal(updated.tag, 'Sinh sản nâng cao')
})
