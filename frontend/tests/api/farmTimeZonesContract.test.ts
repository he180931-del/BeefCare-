import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIME_ZONES } from '../../src/features/farm-workspace/data/provinces'

const backendList = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/src/main/java/vn/edu/fpt/beefcare/service/FarmTimeZones.java')

// FE-02 Q2: SCR-11 offers only UTC+7 zones and the backend rejects any other zone, so both lists must stay identical.
test('the SCR-11 time zone dropdown matches the backend time zone check', () => {
  const java = readFileSync(backendList, 'utf8')
  const block = java.slice(java.indexOf('List.of('), java.indexOf(');', java.indexOf('List.of(')))
  const backend = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(backend, TIME_ZONES.map(([id]) => id))
  assert.equal(backend[0], 'Asia/Ho_Chi_Minh')
})
