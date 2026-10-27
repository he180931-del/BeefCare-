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

test('create assigns the next voucher number and preserves a complete editable draft', async () => {
  globalThis.localStorage = memoryStorage()
  const { herdEntryApi } = await import(`./herdEntryApi.js?test=${Date.now()}`)
  const draft = {
    pricing: 'con', sourceId: 's2', date: '2026-10-27', quarantine: 'KD-TEST', receiver: 'Tester',
    note: 'draft note', cows: [{ tag: 'VN-X', barn: 'A1', weight: 200 }], calves: [],
    freight: 10, paid: 5, method: 'Tiền mặt', due: '2026-11-01', printQr: false,
  }

  const created = await herdEntryApi.create({ type: 'Mua ngoài', status: 'Nháp', draft })
  assert.equal(created.id, 'PN-2026-0014')
  assert.deepEqual((await herdEntryApi.get(created.id)).draft, draft)
})

test('creating a second voucher never overwrites the previous draft', async () => {
  globalThis.localStorage = memoryStorage()
  const { herdEntryApi } = await import(`./herdEntryApi.js?second=${Date.now()}`)
  const first = await herdEntryApi.create({ type: 'Mua ngoài', status: 'Nháp', draft: { note: 'first' } })
  const second = await herdEntryApi.create({ type: 'Bê sinh tại trại', status: 'Nháp', draft: { note: 'second' } })

  assert.notEqual(first.id, second.id)
  assert.equal((await herdEntryApi.get(first.id)).draft.note, 'first')
})

test('voiding a posted entry updates its cattle and voucher together', async () => {
  globalThis.localStorage = memoryStorage()
  const [{ voidHerdEntry, herdEntryApi }, domain] = await Promise.all([
    import(`./herdEntryApi.js?void=${Date.now()}`),
    import(`./herdDomainApi.js?void=${Date.now()}`),
  ])
  const [cow] = await domain.registerEntryCattle([{ barn: 'A1', weight: 210 }], 'PN-VOID-API')
  await herdEntryApi.create({ id: 'PN-VOID-API', type: 'Mua ngoài', status: 'Đã nhập' })

  await voidHerdEntry('PN-VOID-API', [{ code: cow.code, barn: 'A1' }], { status: 'Đã hủy' })

  assert.equal((await domain.cattle.get(cow.code)).status, 'VOIDED')
  assert.equal((await herdEntryApi.get('PN-VOID-API')).status, 'Đã hủy')
})
