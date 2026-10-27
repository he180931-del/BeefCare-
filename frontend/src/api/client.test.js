import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollection } from './client.js'

const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('same collection name shares state and enriches existing rows with later seed fields', async () => {
  globalThis.localStorage = memoryStorage()
  const name = `shared-${Date.now()}`
  const first = createCollection(name, [{ id: 'A1', count: 3 }])
  const second = createCollection(name, [{ id: 'A1', status: 'ACTIVE' }, { id: 'B1', count: 0 }])

  assert.strictEqual(first, second)
  assert.deepEqual(await first.get('A1'), { id: 'A1', status: 'ACTIVE', count: 3 })
  assert.deepEqual(await second.get('B1'), { id: 'B1', count: 0 })
})

test('mutation rejects when localStorage cannot persist the write', async () => {
  let failWrites = false
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      if (failWrites) throw new Error('quota exceeded')
    },
  }
  const rows = createCollection(`write-error-${Date.now()}`, [])
  failWrites = true

  await assert.rejects(rows.create({ id: '1' }), /quota exceeded/)
})
