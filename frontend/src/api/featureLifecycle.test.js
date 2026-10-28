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

test('entry API generates IDs and preserves complete editable drafts', async () => {
  globalThis.localStorage = memoryStorage()
  const { herdEntryApi } = await import(`../features/herd-entry/api/herdEntryApi.js?entry-draft=${Date.now()}`)
  const draft = { type: 'Mua ngoài', date: '2026-10-28', cows: [{ tag: 'VN-X', barn: 'A1', weight: 200 }], docs: [{ name: 'kd.pdf' }] }

  const created = await herdEntryApi.create({ type: 'Mua ngoài', status: 'Nháp', draft })
  assert.equal(created.id, 'PN-2026-0014')
  assert.deepEqual((await herdEntryApi.get(created.id)).draft, draft)
})

test('exit API restores non-sale draft type and synchronizes confirm/cancel once', async () => {
  globalThis.localStorage = memoryStorage()
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?exit-lifecycle=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?exit-lifecycle=${Date.now()}`)
  const draft = { id: 'PX-DRAFT', type: 'Loại thải', status: 'Nháp', draft: { note: 'saved' } }
  assert.equal(exits.getExitDraftState([draft]).type, 'Loại thải')

  await domain.cattle.upsert({ code: 'BC-FEATURE-EXIT', barn: 'A1', status: 'ACTIVE', events: [] })
  const before = (await domain.pens.get('A1')).count
  const cows = [{ code: 'BC-FEATURE-EXIT', barn: 'A1' }]
  await exits.saveHerdExit({ id: 'PX-FEATURE', record: { type: 'Bán', status: 'Đã xuất' }, cattleRows: cows })
  await exits.saveHerdExit({ id: 'PX-FEATURE', record: { type: 'Bán', status: 'Đã xuất' }, cattleRows: cows })
  assert.equal((await domain.pens.get('A1')).count, before - 1)

  await exits.cancelHerdExit('PX-FEATURE', cows, { status: 'Đã hủy' })
  await exits.cancelHerdExit('PX-FEATURE', cows, { status: 'Đã hủy' })
  assert.equal((await domain.cattle.get('BC-FEATURE-EXIT')).status, 'ACTIVE')
  assert.equal((await domain.pens.get('A1')).count, before)
})
