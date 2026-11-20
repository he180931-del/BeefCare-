import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_FARM_TIME_ZONE, FARM_TIME_ZONE_ID, businessDate, fromFarmLocal, toFarmLocal } from '../../src/shared/lib/date/farmTime'

const backendList = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/src/main/java/vn/edu/fpt/beefcare/service/FarmTimeZones.java')

test('frontend and backend use the same canonical field and fixed UTC+7 offset', () => {
  const java = readFileSync(backendList, 'utf8')
  assert.ok(java.includes(`DEFAULT = "${FARM_TIME_ZONE_ID}"`))
  assert.ok(java.includes('ZoneOffset.ofHours(7)'))
  const display = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_FARM_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
  assert.equal(display.format(new Date('2026-10-29T17:00:00Z')), '00:00')
})

test('UTC+7 changes business day at 17:00 UTC and round trips midnight', () => {
  assert.equal(businessDate(new Date('2026-10-29T16:59:59Z')), '2026-10-29')
  assert.equal(businessDate(new Date('2026-10-29T17:00:00Z')), '2026-10-30')
  assert.equal(toFarmLocal('2026-10-29T17:00:00Z'), '2026-10-30T00:00')
  assert.equal(toFarmLocal('2026-10-30T02:00:00+09:00'), '2026-10-30T00:00')
  assert.equal(toFarmLocal('2026-10-30'), '2026-10-30T00:00')
  assert.equal(new Date(fromFarmLocal('2026-10-30T00:00')).toISOString(), '2026-10-29T17:00:00.000Z')
})
