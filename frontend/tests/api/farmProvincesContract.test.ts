import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROVINCES } from '../../src/features/farm-workspace/data/provinces'

const backendList = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/src/main/java/vn/edu/fpt/beefcare/service/VietnamProvinces.java')

// FE-02 Q3: SCR-10 offers the 34 provinces and centrally-run cities and the backend rejects any other name, so both
// lists must stay identical (same names, same spelling, same order).
test('the SCR-10 province dropdown matches the backend province check', () => {
  const java = readFileSync(backendList, 'utf8')
  const block = java.slice(java.indexOf('List.of('), java.indexOf(');', java.indexOf('List.of(')))
  const backend = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1])
  assert.equal(PROVINCES.length, 34)
  assert.deepEqual(backend, [...PROVINCES])
})
