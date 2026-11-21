import { test } from 'vitest'
import assert from 'node:assert/strict'
import { BackendError } from '../../../src/shared/api/backendClient'
import { userFacingError } from '../../../src/shared/api/userFacingError'

test('maps transport failures and access/missing data', () => {
  assert.match(userFacingError(new BackendError(401)), /đăng nhập lại/)
  assert.match(userFacingError(new BackendError(403)), /không có quyền/)
  assert.match(userFacingError(new BackendError(404)), /Không tìm thấy dữ liệu/)
  assert.match(userFacingError(new BackendError(408)), /phản hồi quá lâu/)
  assert.match(userFacingError(new BackendError(504)), /phản hồi quá lâu/)
  assert.match(userFacingError(new BackendError(503)), /Máy chủ đang gặp sự cố/)
  assert.match(userFacingError(new Error('Failed to fetch')), /Không thể kết nối máy chủ/)
})

test('keeps technical and unknown failures behind the caller fallback', () => {
  assert.equal(userFacingError(new Error('error.http.418'), 'fallback'), 'fallback')
  assert.equal(userFacingError(new Error('unknown error'), 'fallback'), 'fallback')
  assert.equal(userFacingError(new Error('A safe message')), 'A safe message')
})

test('classifies generic validation failures without feature-specific copy', () => {
  for (const status of [400, 409, 422]) assert.equal(userFacingError(new BackendError(status)), 'Không thể lưu dữ liệu. Vui lòng kiểm tra lại thông tin.')
  assert.equal(userFacingError(new BackendError(422, { fieldErrors: [{ field: 'x', message: 'required' }] })), 'Không thể lưu dữ liệu. Vui lòng kiểm tra lại thông tin.')
  assert.equal(userFacingError(new BackendError(400, { violations: [{ propertyPath: 'x', message: 'invalid' }] })), 'Không thể lưu dữ liệu. Vui lòng kiểm tra lại thông tin.')
})
