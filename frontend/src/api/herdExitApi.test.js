import test from 'node:test'
import assert from 'node:assert/strict'

const memoryStorage = () => {
  const values = new Map([['beefcare:latency', '0']])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('draft state restores the saved non-sale exit type', async () => {
  globalThis.localStorage = memoryStorage()
  const { getExitDraftState } = await import(`./herdExitApi.js?draft=${Date.now()}`)
  const state = getExitDraftState([{ id: 'PX-1', type: 'Loại thải', status: 'Nháp', draft: { note: 'saved' } }])

  assert.equal(state.type, 'Loại thải')
  assert.equal(state.note, 'saved')
})

test('confirm and cancel exit update cattle and pen occupancy exactly once', async () => {
  globalThis.localStorage = memoryStorage()
  const exits = await import(`./herdExitApi.js?lifecycle=${Date.now()}`)
  const domain = await import(`./herdDomainApi.js?lifecycle=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-EXIT-TEST', barn: 'A1', status: 'ACTIVE', barnHistory: [], events: [] })
  const before = (await domain.pens.get('A1')).count
  const cows = [{ code: 'BC-EXIT-TEST', barn: 'A1' }]

  await exits.saveHerdExit({ id: 'PX-TEST-1', record: { type: 'Bán', status: 'Đã xuất' }, cattleRows: cows })
  assert.equal((await domain.cattle.get('BC-EXIT-TEST')).status, 'EXITED')
  assert.equal((await domain.pens.get('A1')).count, before - 1)

  await exits.cancelHerdExit('PX-TEST-1', cows, { status: 'Đã hủy' })
  await exits.cancelHerdExit('PX-TEST-1', cows, { status: 'Đã hủy' })
  assert.equal((await domain.cattle.get('BC-EXIT-TEST')).status, 'ACTIVE')
  assert.equal((await domain.pens.get('A1')).count, before)
})
