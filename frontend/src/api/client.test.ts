import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollection, createCollectionSchema } from './client'
import type { CollectionRow } from './client'
import { MemoryStorage } from './testUtils'

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
  assert.throws(() => createCollection<TestRow, 'id'>(name, [{ id: 'A1' }], { schema: incompatible }), /schema mismatch/)
})
