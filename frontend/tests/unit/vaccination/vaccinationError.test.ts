import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { mapVaccinationError } from '../../../src/features/vaccination/api/vaccinationError'
import { CONFLICT_MESSAGE, VaccinationValidationError } from '../../../src/features/vaccination/domain/vaccinationRules'

it.each([
  [422, { code: 'MSG-FE18-08', params: { field: 'vaccineId' } }],
  [409, { code: 'MSG-COM-05', params: { reason: 'vaccine_inactive' } }],
])('shows an inactive-vaccine field error for HTTP %i, including older backends', (status, body) => {
  const error = mapVaccinationError(new BackendError(status, body))
  expect(error).toBeInstanceOf(VaccinationValidationError)
  expect((error as VaccinationValidationError).fields).toEqual({ vaccineId: 'Vắc-xin đã ngừng sử dụng, không thể chọn cho bản ghi mới.' })
})

it('keeps a stale-version conflict distinct from an inactive catalogue selection', () => {
  const error = mapVaccinationError(new BackendError(409, { code: 'MSG-COM-05' }))
  expect(error).not.toBeInstanceOf(VaccinationValidationError)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe(CONFLICT_MESSAGE)
})
