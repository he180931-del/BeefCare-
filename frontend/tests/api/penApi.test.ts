import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from '../../src/api/testUtils'

global.localStorage = new MemoryStorage({ 'beefcare:latency': '0' })

test('pen edits use the shared pens collection and refresh cattle acceptance aliases', async () => {
  const [{ penApi }, { pens }] = await Promise.all([import('../../src/api/penApi'), import('../../src/api/herdDomainApi')])
  const before = await pens.get('A1')

  await penApi.update({ ...before, minAge: 15, minWeight: 260, accept: 'Sinh sản nâng cao' })

  const updated = await pens.get('A1')
  assert.equal(updated.minMonths, 15)
  assert.equal(updated.minKg, 260)
  assert.equal(updated.tag, 'Sinh sản nâng cao')
})

test('backend pen mapping reads constraints from the current-criteria envelope', async () => {
  const { mapBackendPen } = await import('../../src/features/pen-management/api/penApi')
  const mapped = mapBackendPen({
    id: 9,
    code: 'A2',
    name: 'Bò chửa',
    capacity: 30,
    status: 'ACTIVE',
    version: 4,
    currentCriteria: {
      versionNo: 2,
      criteria: {
        purposeTypes: ['BREEDING'],
        lifeStages: ['ADULT'],
        sex: 'FEMALE',
        minAgeMonths: 12,
        minWeightKg: 230,
      },
    },
  })

  assert.equal(mapped.purpose, 'Sinh sản')
  assert.equal(mapped.stage, 'Bò trưởng thành')
  assert.equal(mapped.sex, 'Cái')
  assert.equal(mapped.minAge, 12)
  assert.equal(mapped.minAgeOp, '≥')
  assert.equal(mapped.minWeight, 230)
  assert.equal(mapped.minWeightOp, '≥')
})

test('backend pen mapping translates the compact accepts summary when list omits criteria', async () => {
  const { mapBackendPen } = await import('../../src/features/pen-management/api/penApi')
  const mapped = mapBackendPen({
    id: 10,
    code: 'B1',
    name: 'Bò vỗ béo',
    capacity: 50,
    headcount: 4,
    status: 'ACTIVE',
    acceptsSummary: 'BREEDING | ADULT | FEMALE | age >= 45 months | weight >= 200 kg',
  })

  assert.equal(mapped.accept, 'Sinh sản | Bò trưởng thành | Cái | tuổi ≥ 45 tháng · cân ≥ 200 kg')
  assert.equal(mapped.purpose, 'Sinh sản')
  assert.equal(mapped.stage, 'Bò trưởng thành')
  assert.equal(mapped.sex, 'Cái')
  assert.equal(mapped.minAge, 45)
  assert.equal(mapped.minWeight, 200)
})
