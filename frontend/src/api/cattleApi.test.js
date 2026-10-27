import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map([['beefcare:latency', '0']])
global.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

test('every sample cow shown by a pen resolves to a cattle profile in that pen', async () => {
  const { listBarns, listCows } = await import('./cattleApi.js')
  const [barns, cows] = await Promise.all([listBarns(), listCows()])
  const cowsByCode = Object.fromEntries(cows.map((cow) => [cow.code, cow]))

  for (const barn of barns) {
    for (const [code] of barn.cows ?? []) {
      assert.ok(cowsByCode[code], `${code} must have a cattle profile`)
      assert.equal(cowsByCode[code].barn, barn.code, `${code} must belong to ${barn.code}`)
    }
  }
  assert.equal(store.has('beefcare:barns'), false)
})
