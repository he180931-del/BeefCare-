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

test('registering, exiting and restoring cattle adjusts one shared pen count exactly once', async () => {
  globalThis.localStorage = memoryStorage()
  const domain = await import(`./herdDomainApi.ts?test=${Date.now()}`)
  const a1 = await domain.pens.get('A1')
  const before = a1.count

  const [cow] = await domain.registerEntryCattle(
    [{ tag: 'VN-TEST', breed: 'Zebu đỏ', sex: 'Cái', stage: 'Bò tơ', barn: 'A1', weight: 220 }],
    'PN-TEST-1',
  )
  assert.equal((await domain.pens.get('A1')).count, before + 1)

  await domain.registerEntryCattle([{ ...cow, barn: 'A1' }], 'PN-TEST-1')
  assert.equal((await domain.pens.get('A1')).count, before + 1)

  await domain.confirmCattleExit([{ code: cow.code, barn: 'A1' }], 'PX-TEST-1')
  assert.equal((await domain.cattle.get(cow.code)).status, 'EXITED')
  assert.equal((await domain.pens.get('A1')).count, before)

  await domain.cancelCattleExit([{ code: cow.code, barn: 'A1' }], 'PX-TEST-1')
  await domain.cancelCattleExit([{ code: cow.code, barn: 'A1' }], 'PX-TEST-1')
  assert.equal((await domain.cattle.get(cow.code)).status, 'ACTIVE')
  assert.equal((await domain.pens.get('A1')).count, before + 1)
})

test('moving cattle rejects inactive destinations without changing either pen', async () => {
  globalThis.localStorage = memoryStorage()
  const domain = await import(`./herdDomainApi.ts?move=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-MOVE', barn: 'A1', status: 'ACTIVE', barnHistory: [], events: [] })
  const fromBefore = (await domain.pens.get('A1')).count
  const toBefore = (await domain.pens.get('E')).count

  await assert.rejects(
    domain.moveCattle('BC-MOVE', { to: 'E', date: '2026-10-27', reason: 'test', by: 'Tester' }),
    /inactive/i,
  )
  assert.equal((await domain.pens.get('A1')).count, fromBefore)
  assert.equal((await domain.pens.get('E')).count, toBefore)
})

test('voiding an entry marks its cattle VOIDED and releases pen occupancy once', async () => {
  globalThis.localStorage = memoryStorage()
  const domain = await import(`./herdDomainApi.ts?void-entry=${Date.now()}`)
  const before = (await domain.pens.get('A1')).count
  const [cow] = await domain.registerEntryCattle(
    [{ tag: 'VN-VOID', breed: 'Zebu đỏ', sex: 'Cái', stage: 'Bò tơ', barn: 'A1', weight: 220 }],
    'PN-VOID-1',
  )

  await domain.voidEntryCattle([{ code: cow.code, barn: 'A1' }], 'PN-VOID-1')
  await domain.voidEntryCattle([{ code: cow.code, barn: 'A1' }], 'PN-VOID-1')

  const voided = await domain.cattle.get(cow.code)
  assert.equal(voided.status, 'VOIDED')
  assert.equal(voided.barn, null)
  assert.equal((await domain.pens.get('A1')).count, before)
})

test('moving a non-active cattle is rejected before occupancy changes', async () => {
  globalThis.localStorage = memoryStorage()
  const domain = await import(`./herdDomainApi.ts?move-exited=${Date.now()}`)
  await domain.cattle.upsert({ code: 'BC-EXITED-MOVE', barn: 'A1', status: 'EXITED', barnHistory: [], events: [] })
  const fromBefore = (await domain.pens.get('A1')).count
  const toBefore = (await domain.pens.get('C1')).count

  await assert.rejects(
    domain.moveCattle('BC-EXITED-MOVE', { to: 'C1', date: '2026-10-27', reason: 'test', by: 'Tester' }),
    /not active/i,
  )
  assert.equal((await domain.pens.get('A1')).count, fromBefore)
  assert.equal((await domain.pens.get('C1')).count, toBefore)
})
