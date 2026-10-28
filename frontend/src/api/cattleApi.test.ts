import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './testUtils'

const store = new MemoryStorage({ 'beefcare:latency': '0' })
global.localStorage = store

test('every sample cow shown by a pen resolves to a cattle profile in that pen', async () => {
  const { listBarns, listCows } = await import('./cattleApi')
  const [barns, cows] = await Promise.all([listBarns(), listCows()])
  const cowsByCode = Object.fromEntries(cows.map((cow) => [cow.code, cow]))

  for (const barn of barns) {
    for (const [code] of barn.cows ?? []) {
      assert.ok(cowsByCode[code], `${code} must have a cattle profile`)
      assert.equal(cowsByCode[code].barn, barn.code, `${code} must belong to ${barn.code}`)
    }
  }
  assert.equal(store.getItem('beefcare:barns'), null)
})

test('profile mutations reject cattle that are no longer ACTIVE', async () => {
  const [{ updateIdentity }, { cattle }] = await Promise.all([import('./cattleApi'), import('./herdDomainApi')])
  await cattle.update('BC-000125', { status: 'EXITED' })

  await assert.rejects(updateIdentity('BC-000125', { name: 'Không được sửa' }), /not active/i)
})
