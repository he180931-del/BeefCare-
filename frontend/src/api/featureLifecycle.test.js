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

test('entry posting allocates its ID before linking cattle when no ID is supplied', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-post=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-post=${Date.now()}`)
  const saved = await entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập' },
    cattleRows: [{ tag: 'VN-GEN', barn: 'C1', weight: 210, date: '2026-10-28' }],
  })
  assert.match(saved.id, /^PN-2026-\d{4}$/)
  assert.equal(saved.detail.cows.length, 1)
  const cattle = (await domain.cattle.list()).find((row) => row.tag === 'VN-GEN')
  assert.equal(cattle.entryVoucherId, saved.id)
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
  await exits.saveHerdExit({ id: 'PX-FEATURE', record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' }, cattleRows: cows })
  await exits.saveHerdExit({ id: 'PX-FEATURE', record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' }, cattleRows: cows })
  assert.equal((await domain.pens.get('A1')).count, before - 1)

  await exits.cancelHerdExit('PX-FEATURE', cows, { status: 'Đã hủy' })
  await exits.cancelHerdExit('PX-FEATURE', cows, { status: 'Đã hủy' })
  assert.equal((await domain.cattle.get('BC-FEATURE-EXIT')).status, 'ACTIVE')
  assert.equal((await domain.pens.get('A1')).count, before)
})

test('exit posting allocates its ID first and blocks withdrawal confirmation', async () => {
  globalThis.localStorage = memoryStorage()
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?exit-generated=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?exit-generated=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-GEN-EXIT', barn: 'A1', status: 'ACTIVE', events: [] })
  await assert.rejects(
    exits.saveHerdExit({
      record: { date: '2026-10-22', type: 'Bán', status: 'Đã xuất' },
      cattleRows: [{ code: 'BC-GEN-EXIT', barn: 'A1', withdrawalUntil: '2026-10-25' }],
    }),
    /withdrawal/i,
  )
  const saved = await exits.saveHerdExit({
    record: { date: '2026-10-26', type: 'Bán', status: 'Đã xuất' },
    cattleRows: [{ code: 'BC-GEN-EXIT', barn: 'A1' }],
  })
  assert.match(saved.id, /^PX-2026-\d{4}$/)
})

test('terminal entry and exit vouchers reject mutation through their save facades', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-terminal=${Date.now()}`)
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?exit-terminal=${Date.now()}`)
  const entry = await entries.herdEntryApi.create({ id: 'PN-TERM', status: 'Đã nhập', type: 'Mua ngoài' })
  const exit = await exits.herdExitApi.create({ id: 'PX-TERM', status: 'Đã bác', type: 'Bán' })
  await assert.rejects(entries.saveHerdEntry({ id: entry.id, record: { status: 'Nháp' } }), /terminal/i)
  await assert.rejects(exits.saveHerdExit({ id: exit.id, record: { status: 'Nháp' } }), /terminal/i)
})

test('posting APIs reject missing required fields before mutating cattle', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?required-entry=${Date.now()}`)
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?required-exit=${Date.now()}`)
  await assert.rejects(entries.saveHerdEntry({ record: { type: 'Mua ngoài', status: 'Đã nhập' }, cattleRows: [{ code: 'x', barn: 'A1' }] }), /requires date/i)
  await assert.rejects(exits.saveHerdExit({ record: { date: '2026-10-28', type: 'Loại thải', status: 'Đã xuất' }, cattleRows: [{ code: 'x', barn: 'A1' }] }), /reason|note|required/i)
})

test('entry posting rejects inactive and full canonical pens', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?pen-validation=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?pen-validation=${Date.now()}`)
  await assert.rejects(entries.saveHerdEntry({ record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập' }, cattleRows: [{ code: 'BC-INACTIVE', barn: 'E', weight: 100 }] }), /inactive/i)
  const pen = await domain.pens.get('C1')
  await domain.pens.update('C1', { count: pen.capacity })
  await assert.rejects(entries.saveHerdEntry({ record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập' }, cattleRows: [{ code: 'BC-FULL', barn: 'C1', weight: 100 }] }), /full|capacity/i)
})
