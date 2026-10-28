import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollection, createCollectionSchema } from './client'
import type { CollectionRow } from './client'
import { MemoryStorage } from './testUtils'
import { cattleSchema, herdEntrySchema, herdExitSchema, penSchema } from './collectionSchemas'
import type { Cattle, HerdEntry, HerdExit, Pen } from '../types'

const memoryStorage = () => new MemoryStorage()
type TestRow = CollectionRow & { id: string; count?: number; status?: string }
const parseTestRow = (value: unknown): TestRow => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid test row')
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string') throw new Error('invalid test row id')
  return { ...row, id: row.id, ...(typeof row.count === 'number' ? { count: row.count } : {}), ...(typeof row.status === 'string' ? { status: row.status } : {}) }
}
const testSchema = createCollectionSchema<TestRow, 'id'>('client-test-v1', 'id', parseTestRow)

test('same collection name shares state and enriches existing rows with later seed fields', async () => {
  globalThis.localStorage = memoryStorage()
  const name = `shared-${Date.now()}`
  const first = createCollection<TestRow, 'id'>(name, [{ id: 'A1', count: 3 }], { schema: testSchema })
  const second = createCollection<TestRow, 'id'>(name, [{ id: 'A1', status: 'ACTIVE' }, { id: 'B1', count: 0 }], { schema: testSchema })

  assert.strictEqual(first, second)
  assert.deepEqual(await first.get('A1'), { id: 'A1', status: 'ACTIVE', count: 3 })
  assert.deepEqual(await second.get('B1'), { id: 'B1', count: 0 })
})

test('mutation rejects when localStorage cannot persist the write', async () => {
  let failWrites = false
  const storage = new MemoryStorage()
  storage.setItem = () => { if (failWrites) throw new Error('quota exceeded') }
  globalThis.localStorage = storage
  const rows = createCollection<{ id: string }, 'id'>(`write-error-${Date.now()}`, [], { schema: createCollectionSchema('write-error-v1', 'id', (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || typeof (value as Record<string, unknown>).id !== 'string') throw new Error('invalid row')
    return { id: (value as Record<string, unknown>).id as string }
  }) })
  failWrites = true

  await assert.rejects(rows.create({ id: '1' }), /quota exceeded/)
})

test('malformed persisted JSON is repaired from the validated seed', async () => {
  const name = `malformed-${Date.now()}`
  const storage = new MemoryStorage({ [`beefcare:${name}`]: '{not-json' })
  globalThis.localStorage = storage
  const rows = createCollection<TestRow, 'id'>(name, [{ id: 'SEED', count: 1 }], { schema: testSchema })
  assert.deepEqual(await rows.list(), [{ id: 'SEED', count: 1 }])
  assert.deepEqual(JSON.parse(storage.getItem(`beefcare:${name}`) ?? 'null'), [{ id: 'SEED', count: 1 }])
})

test('non-array and invalid rows in persisted JSON are repaired from the seed', async () => {
  const name = `invalid-row-${Date.now()}`
  const storage = new MemoryStorage({ [`beefcare:${name}`]: JSON.stringify({ id: 'wrong-shape' }) })
  globalThis.localStorage = storage
  const rows = createCollection<TestRow, 'id'>(name, [{ id: 'SEED', status: 'ACTIVE' }], { schema: testSchema })
  assert.deepEqual(await rows.list(), [{ id: 'SEED', status: 'ACTIVE' }])
  const wrongRowName = `invalid-row-wrong-${Date.now()}`
  storage.setItem(`beefcare:${wrongRowName}`, JSON.stringify([{ id: 42 }]))
  const wrongRow = createCollection<TestRow, 'id'>(wrongRowName, [{ id: 'SEED', status: 'ACTIVE' }], { schema: testSchema })
  assert.deepEqual(await wrongRow.list(), [{ id: 'SEED', status: 'ACTIVE' }])
})

test('same collection name rejects an incompatible schema identity', () => {
  const name = `schema-mismatch-${Date.now()}`
  globalThis.localStorage = memoryStorage()
  createCollection<TestRow, 'id'>(name, [{ id: 'A1' }], { schema: testSchema })
  const incompatible = createCollectionSchema<TestRow, 'id'>('client-test-v2', 'id', parseTestRow)
  assert.throws(() => createCollection<TestRow, 'id'>(name, [{ id: 'A1' }], { schema: incompatible }), /schema contract mismatch/)
})

test('upsert returns and persists the merged complete record', async () => {
  const name = `upsert-merge-${Date.now()}`
  const storage = memoryStorage()
  globalThis.localStorage = storage
  const rows = createCollection<TestRow, 'id'>(name, [{ id: 'A1', count: 3, status: 'OLD', retained: 'yes' }], { schema: testSchema })
  const updated = await rows.upsert({ id: 'A1', count: 4, status: 'ACTIVE' })
  assert.deepEqual(updated, { id: 'A1', count: 4, status: 'ACTIVE', retained: 'yes' })
  assert.deepEqual(JSON.parse(storage.getItem(`beefcare:${name}`) ?? 'null'), [{ id: 'A1', count: 4, status: 'ACTIVE', retained: 'yes' }])
})

test('same identity and id key still reject a different schema contract object', () => {
  const name = `schema-contract-${Date.now()}`
  globalThis.localStorage = memoryStorage()
  createCollection<TestRow, 'id'>(name, [{ id: 'A1' }], { schema: testSchema })
  const differentParser = createCollectionSchema<TestRow, 'id'>('client-test-v1', 'id', parseTestRow)
  assert.throws(() => createCollection<TestRow, 'id'>(name, [{ id: 'A1' }], { schema: differentParser }), /schema contract mismatch/)
})

test('malformed nested entry and exit JSON is repaired before UI consumers read it', async () => {
  const entryName = `nested-entry-${Date.now()}`
  const exitName = `nested-exit-${Date.now()}`
  globalThis.localStorage = new MemoryStorage({
    [`beefcare:${entryName}`]: JSON.stringify([{ id: 'BAD', status: 'Nháp', draft: { cows: [null] } }]),
    [`beefcare:${exitName}`]: JSON.stringify([{ id: 'BAD', status: 'Đã xuất', detail: { payments: [null] } }]),
  })
  const entries = createCollection<HerdEntry, 'id'>(entryName, [{ id: 'SEED', status: 'Nháp' }], { schema: herdEntrySchema })
  const exits = createCollection<HerdExit, 'id'>(exitName, [{ id: 'SEED', status: 'Nháp' }], { schema: herdExitSchema })
  assert.deepEqual(await entries.list(), [{ id: 'SEED', status: 'Nháp' }])
  assert.deepEqual(await exits.list(), [{ id: 'SEED', status: 'Nháp' }])
})

test('entry and exit draft cow rows require their exact form fields', async () => {
  const entryCases: Array<{ name: string; bad: CollectionRow }> = [
    { name: `entry-empty-cow-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { cows: [{}] } } },
    { name: `entry-missing-hist-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { cows: [{ tag: '', name: '', breed: '', sex: '', dob: '', dobAccuracy: '', stage: '', purpose: '', weight: 0, estimated: false, barn: '', unitPrice: 0 }] } } },
    { name: `entry-malformed-hist-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { cows: [{ tag: '', name: '', breed: '', sex: '', dob: '', dobAccuracy: '', stage: '', purpose: '', weight: 0, estimated: false, barn: '', unitPrice: 0, hist: { vaccine: 'Có', disease: 'Không rõ', repro: 7 } }] } } },
    { name: `entry-bad-calf-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { calves: [{}] } } },
  ]
  for (const item of entryCases) {
    const seed: HerdEntry = { id: 'SEED', status: 'Nháp' }
    globalThis.localStorage = new MemoryStorage({ [`beefcare:${item.name}`]: JSON.stringify([item.bad]) })
    const collection = createCollection(item.name, [seed], { schema: herdEntrySchema })
    assert.deepEqual(await collection.list(), [seed], 'entry')
  }
  const exitCases: Array<{ name: string; bad: CollectionRow }> = [
    { name: `exit-empty-cow-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { cows: [{}] } } },
    { name: `exit-bad-cow-${Date.now()}`, bad: { id: 'BAD', status: 'Nháp', draft: { cows: [{ code: 'BC-1', weight: 1, unitPrice: {}, estimated: false }] } } },
  ]
  for (const item of exitCases) {
    const seed: HerdExit = { id: 'SEED', status: 'Nháp' }
    globalThis.localStorage = new MemoryStorage({ [`beefcare:${item.name}`]: JSON.stringify([item.bad]) })
    const collection = createCollection(item.name, [seed], { schema: herdExitSchema })
    assert.deepEqual(await collection.list(), [seed], 'exit')
  }
})

test('malformed cattle history containers and elements are repaired before lifecycle code reads them', async () => {
  const seed: Cattle = { code: 'SEED-COW', barn: null, status: 'ACTIVE', events: [], barnHistory: [], qrHistory: [] }
  const cases: CollectionRow[] = [
    { events: {} },
    { barnHistory: {} },
    { barnHistory: [null] },
    { barnHistory: [{ to: 42 }] },
    { qrHistory: {} },
    { qrHistory: [null] },
    { qrHistory: [{ status: { value: 'ACTIVE' } }] },
  ]
  for (const [index, nested] of cases.entries()) {
    const name = `malformed-cattle-${Date.now()}-${index}`
    globalThis.localStorage = new MemoryStorage({ [`beefcare:${name}`]: JSON.stringify([{ ...seed, code: 'BAD-COW', ...nested }]) })
    const cattle = createCollection<Cattle, 'code'>(name, [seed], { schema: cattleSchema })
    assert.deepEqual(await cattle.list(), [seed])
  }
})

test('malformed pen nested arrays and timeline fields are repaired before occupancy code reads them', async () => {
  const seed: Pen = { code: 'SEED-PEN', name: 'Seed pen', count: 0, capacity: 10, status: 'ACTIVE', cows: [] }
  const cases: CollectionRow[] = [
    { cows: [['BC-1', {}]] },
    { aliases: {} },
    { aliases: [null] },
    { samples: {} },
    { samples: [null] },
    { history: {} },
    { history: [null] },
  ]
  for (const [index, nested] of cases.entries()) {
    const name = `malformed-pen-${Date.now()}-${index}`
    globalThis.localStorage = new MemoryStorage({ [`beefcare:${name}`]: JSON.stringify([{ ...seed, code: 'BAD-PEN', ...nested }]) })
    const pens = createCollection<Pen, 'code'>(name, [seed], { schema: penSchema })
    assert.deepEqual(await pens.list(), [seed])
  }
})
