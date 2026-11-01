import test from 'node:test'
import assert from 'node:assert/strict'
import { BackendError } from '../../../src/api/backendClient'
import { userFacingError } from '../../../src/api/userFacingError'

test('maps server and transport failures', () => {
  assert.match(userFacingError(new BackendError(500, { message: 'error.http.500' })), /Máy chủ đang gặp sự cố/)
  assert.match(userFacingError(new Error('Failed to fetch')), /Không thể kết nối máy chủ/)
  assert.match(userFacingError(new BackendError(504)), /phản hồi quá lâu/)
})
test('maps access, missing data and validation failures', () => {
  assert.match(userFacingError(new BackendError(401)), /đăng nhập lại/)
  assert.match(userFacingError(new BackendError(404)), /Không tìm thấy dữ liệu/)
  assert.match(userFacingError(new BackendError(422, { fieldErrors: [{ field: 'receiver', message: 'required' }] })), /Người nhập: required/)
})
test('renders actionable Vietnamese field messages from Entry domain errors', () => {
  assert.equal(userFacingError(new BackendError(400, { code: 'MSG-COM-06', params: { field: 'weightBasis' }, message: 'Vui lòng nhập weightBasis.' })), 'Vui lòng nhập Cơ sở cân.')
  assert.equal(userFacingError(new BackendError(422, { code: 'MSG-COM-10', params: { field: 'unitPrice' }, message: 'unitPrice không hợp lệ.' })), 'Đơn giá không hợp lệ.')
  assert.equal(userFacingError(new BackendError(422, { code: 'MSG-FE18-08', params: { field: 'breed' }, message: 'breed không phải là giá trị danh mục đang hoạt động.' })), 'Giống không nằm trong danh mục đang hoạt động.')
})
test('does not expose technical HTTP keys', () => assert.doesNotMatch(userFacingError(new Error('error.http.500')), /error\.http\.500/))
test('does not expose English network or validation keys', () => {
  assert.doesNotMatch(userFacingError(new Error('Network Error')), /Network Error/)
  assert.doesNotMatch(userFacingError(new Error('error.validation')), /error\.validation/)
})

test('maps pen update domain errors to actionable Vietnamese messages', () => {
  assert.equal(
    userFacingError(new BackendError(422, { code: 'MSG-FE04-02', params: { pen_code: 'A2' }, message: 'error.validation' })),
    'Mã chuồng A2 đã tồn tại trong trại này.',
  )
  assert.equal(
    userFacingError(new BackendError(422, { code: 'MSG-FE04-03', params: { min_capacity: 4 }, message: 'error.validation' })),
    'Sức chứa phải là số nguyên tối thiểu 4.',
  )
  assert.equal(
    userFacingError(new BackendError(409, { code: 'MSG-COM-05', message: 'error.validation' })),
    'Thông tin chuồng đã thay đổi. Vui lòng tải lại trang rồi thử lại.',
  )
})

test('maps RFC validation violations and fields instead of exposing error.validation', () => {
  assert.equal(
    userFacingError(new BackendError(400, { message: 'error.validation', violations: [{ field: 'capacity', message: 'phải lớn hơn 0' }] })),
    'Sức chứa: phải lớn hơn 0',
  )
  assert.equal(
    userFacingError(new BackendError(400, { message: 'error.validation', fieldErrors: [{ field: 'description', message: 'quá dài' }] })),
    'Mô tả: quá dài',
  )
})
