import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateHerdStorage } from './storageMigrations'
import { MemoryStorage } from './testUtils'

const memoryStorage = (initial: Record<string, string> = {}) => new MemoryStorage(initial)

test('legacy barns migrate once to pens while preserving edits and fixing sample links', () => {
  const storage = memoryStorage({
    'beefcare:barns': JSON.stringify([{ code: 'A1', capacity: 99, count: 60, cows: [['BC-MISSING', 'broken']] }]),
  })

  assert.equal(migrateHerdStorage(storage), true)
  const pens = JSON.parse(storage.getItem('beefcare:pens') ?? '[]') as Array<{ code: string; capacity: number; count: number; cows: string[][] }>
  const a1 = pens.find((row) => row.code === 'A1')!
  assert.equal(a1.capacity, 99)
  assert.equal(a1.count, 60)
  assert.deepEqual(a1.cows, [['BC-000125', 'Mang thai 5 tháng']])
  assert.equal(storage.getItem('beefcare:barns'), null)

  a1.count = 61
  storage.setItem('beefcare:pens', JSON.stringify(pens))
  assert.equal(migrateHerdStorage(storage), false)
  assert.equal((JSON.parse(storage.getItem('beefcare:pens') ?? '[]') as Array<{ code: string; count: number }>).find((row) => row.code === 'A1')?.count, 61)
})
