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
  const { getEntryDraftState, herdEntryApi } = await import(`../features/herd-entry/api/herdEntryApi.js?entry-draft=${Date.now()}`)
  const draft = { type: 'Mua ngoài', date: '2026-10-28', cows: [{ tag: 'VN-X', barn: 'A1', weight: 200 }], docs: [{ name: 'kd.pdf' }] }

  const created = await herdEntryApi.create({ type: 'Mua ngoài', status: 'Nháp', draft })
  assert.equal(created.id, 'PN-2026-0014')
  assert.deepEqual((await herdEntryApi.get(created.id)).draft, draft)
  assert.equal(getEntryDraftState([created], created.id).row.id, created.id)
  assert.equal(getEntryDraftState([created]).row, undefined)
})

test('entry posting allocates its ID before linking cattle when no ID is supplied', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-post=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-post=${Date.now()}`)
  const saved = await entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-GEN' } },
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
  assert.equal(exits.getExitDraftState([draft], draft.id).row.id, draft.id)
  assert.equal(exits.getExitDraftState([draft], 'PX-MISSING').row, undefined)

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
  assert.equal((await domain.cattle.get('BC-GEN-EXIT')).exitVoucherId, saved.id)
  await exits.cancelHerdExit(saved.id, [{ code: 'BC-GEN-EXIT', barn: 'A1' }])
  assert.equal((await domain.cattle.get('BC-GEN-EXIT')).status, 'ACTIVE')
  assert.equal((await domain.cattle.get('BC-GEN-EXIT')).exitVoucherId, null)
})

test('exit confirmation preflights missing, inactive, and differently linked cattle without side effects', async () => {
  globalThis.localStorage = memoryStorage()
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?exit-preflight=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?exit-preflight=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-EXIT-PREFLIGHT', barn: 'A1', status: 'ACTIVE', events: [] })
  await domain.cattle.upsert({ code: 'BC-EXIT-INACTIVE', barn: 'A1', status: 'EXITED', events: [] })
  await domain.cattle.upsert({ code: 'BC-EXIT-DIFFERENT', barn: 'A1', status: 'EXITED', exitVoucherId: 'PX-OTHER', events: [] })
  const before = (await domain.pens.get('A1')).count

  await assert.rejects(exits.saveHerdExit({
    record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' },
    cattleRows: [{ code: 'BC-EXIT-PREFLIGHT', barn: 'A1' }, { code: 'BC-EXIT-MISSING', barn: 'A1' }],
  }), /missing|not found/i)
  assert.equal((await domain.cattle.get('BC-EXIT-PREFLIGHT')).status, 'ACTIVE')
  assert.equal((await domain.pens.get('A1')).count, before)

  await assert.rejects(exits.saveHerdExit({
    record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' },
    cattleRows: [{ code: 'BC-EXIT-INACTIVE', barn: 'A1' }],
  }), /not active/i)
  assert.equal((await domain.cattle.get('BC-EXIT-INACTIVE')).status, 'EXITED')
  assert.equal((await domain.pens.get('A1')).count, before)

  await assert.rejects(exits.saveHerdExit({
    record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' },
    cattleRows: [{ code: 'BC-EXIT-DIFFERENT', barn: 'A1' }],
  }), /different|voucher|active/i)
  assert.equal((await domain.cattle.get('BC-EXIT-DIFFERENT')).exitVoucherId, 'PX-OTHER')
})

test('canceling an exit requires every linked cattle row and restores all exactly once', async () => {
  globalThis.localStorage = memoryStorage()
  const exits = await import(`../features/herd-exit/api/herdExitApi.js?exit-cancel-complete=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?exit-cancel-complete=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-CANCEL-1', barn: 'A1', status: 'ACTIVE', events: [] })
  await domain.cattle.upsert({ code: 'BC-CANCEL-2', barn: 'A1', status: 'ACTIVE', events: [] })
  const before = (await domain.pens.get('A1')).count
  const rows = [{ code: 'BC-CANCEL-1', barn: 'A1' }, { code: 'BC-CANCEL-2', barn: 'A1' }]
  const saved = await exits.saveHerdExit({ id: 'PX-CANCEL-COMPLETE', record: { date: '2026-10-28', type: 'Bán', status: 'Đã xuất' }, cattleRows: rows })
  assert.equal((await domain.pens.get('A1')).count, before - 2)

  await assert.rejects(exits.cancelHerdExit(saved.id, [rows[0]]), /all|complete|linked/i)
  assert.equal((await exits.herdExitApi.get(saved.id)).status, 'Đã xuất')
  assert.equal((await domain.pens.get('A1')).count, before - 2)
  await exits.cancelHerdExit(saved.id, rows)
  await exits.cancelHerdExit(saved.id, rows)
  assert.equal((await domain.pens.get('A1')).count, before)
  assert.equal((await domain.cattle.get('BC-CANCEL-1')).status, 'ACTIVE')
  assert.equal((await domain.cattle.get('BC-CANCEL-2')).status, 'ACTIVE')
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

test('canceled entry vouchers cannot be reopened through the save facade', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-canceled-terminal=${Date.now()}`)
  const entry = await entries.herdEntryApi.create({ id: 'PN-CANCELED', status: 'Đã hủy', type: 'Mua ngoài' })
  await assert.rejects(entries.saveHerdEntry({ id: entry.id, record: { status: 'Nháp', draft: { note: 'reopen' } } }), /terminal/i)
})

test('voiding an entry requires every linked cattle row before canceling the voucher', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-void-complete=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-void-complete=${Date.now()}`)
  const saved = await entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-VOID' } },
    cattleRows: [
      { tag: 'VN-VOID-1', barn: 'A1', weight: 100 },
      { tag: 'VN-VOID-2', barn: 'A1', weight: 110 },
    ],
  })
  const detail = (await entries.herdEntryApi.get(saved.id)).detail.cows
  await assert.rejects(entries.voidHerdEntry(saved.id, [detail[0]]), /all|complete|mismatch/i)
  await assert.rejects(entries.voidHerdEntry(saved.id, []), /all|complete|mismatch/i)
  assert.equal((await entries.herdEntryApi.get(saved.id)).status, 'Đã nhập')
  assert.equal((await domain.cattle.get(detail[0].code)).status, 'ACTIVE')
  assert.equal((await domain.cattle.get(detail[1].code)).status, 'ACTIVE')
})

test('entry posting preflights every row before mutating cattle', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-preflight=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-preflight=${Date.now()}`)
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-PREFLIGHT' } },
    cattleRows: [
      { tag: 'VN-PREFLIGHT-1', barn: 'A1', weight: 100 },
      { tag: 'VN-PREFLIGHT-2', barn: 'E', weight: 110 },
    ],
  }), /inactive/i)
  assert.equal((await domain.cattle.list()).some((row) => row.tag === 'VN-PREFLIGHT-1'), false)
})

test('entry posting validates quarantine, future dates, and duplicate ear tags', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-validation=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-validation=${Date.now()}`)
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập' },
    cattleRows: [{ tag: 'VN-REQUIRED-KD', barn: 'A1', weight: 100 }],
  }), /quarantine|kiểm dịch/i)
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2999-01-01', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-FUTURE' } },
    cattleRows: [{ tag: 'VN-FUTURE', barn: 'A1', weight: 100 }],
  }), /future|tương lai/i)
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-DUP' } },
    cattleRows: [{ tag: 'VN-DUP', barn: 'A1', weight: 100 }, { tag: 'VN-DUP', barn: 'A1', weight: 110 }],
  }), /duplicate|trùng/i)
  await domain.cattle.upsert({ code: 'BC-EXISTING-TAG', tag: 'VN-EXISTING', barn: 'A1', status: 'ACTIVE', events: [] })
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-EXISTING' } },
    cattleRows: [{ tag: 'VN-EXISTING', barn: 'A1', weight: 100 }],
  }), /duplicate|trùng/i)
})

test('entry posting rejects duplicate explicit cattle codes before overwriting or changing pens', async () => {
  globalThis.localStorage = memoryStorage()
  const entries = await import(`../features/herd-entry/api/herdEntryApi.js?entry-code-preflight=${Date.now()}`)
  const domain = await import(`../api/herdDomainApi.js?entry-code-preflight=${Date.now()}`)
  const before = (await domain.pens.get('A1')).count
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-CODE-DUP' } },
    cattleRows: [
      { code: 'BC-EXPLICIT-DUP', tag: 'VN-CODE-1', barn: 'A1', weight: 100 },
      { code: 'BC-EXPLICIT-DUP', tag: 'VN-CODE-2', barn: 'A1', weight: 110 },
    ],
  }), /duplicate|trùng|code/i)
  assert.equal((await domain.cattle.get('BC-EXPLICIT-DUP').catch(() => null)), null)
  assert.equal((await domain.pens.get('A1')).count, before)

  await entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-CODE-OWNED' } },
    cattleRows: [{ code: 'BC-EXPLICIT-OWNED', tag: 'VN-CODE-OWNED', barn: 'A1', weight: 100 }],
  })
  const ownedBefore = (await domain.pens.get('A1')).count
  await assert.rejects(entries.saveHerdEntry({
    record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-CODE-REUSE' } },
    cattleRows: [{ code: 'BC-EXPLICIT-OWNED', tag: 'VN-CODE-REUSE', barn: 'A1', weight: 110 }],
  }), /duplicate|already|code/i)
  assert.equal((await domain.cattle.get('BC-EXPLICIT-OWNED')).tag, 'VN-CODE-OWNED')
  assert.equal((await domain.pens.get('A1')).count, ownedBefore)
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
  await assert.rejects(entries.saveHerdEntry({ record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-INACTIVE' } }, cattleRows: [{ code: 'BC-INACTIVE', barn: 'E', weight: 100 }] }), /inactive/i)
  const pen = await domain.pens.get('C1')
  await domain.pens.update('C1', { count: pen.capacity })
  await assert.rejects(entries.saveHerdEntry({ record: { date: '2026-10-28', type: 'Mua ngoài', status: 'Đã nhập', detail: { quarantine: 'KD-FULL' } }, cattleRows: [{ code: 'BC-FULL', barn: 'C1', weight: 100 }] }), /full|capacity/i)
})
