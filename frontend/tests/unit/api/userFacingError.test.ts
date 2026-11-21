import { test } from 'vitest'
import assert from 'node:assert/strict'
import { BackendError } from '../../../src/shared/api/backendClient'
import { userFacingError } from '../../../src/shared/api/userFacingError'

test('maps server and transport failures', () => {
  assert.match(userFacingError(new BackendError(500, { message: 'error.http.500' })), /Máy chủ đang gặp sự cố/)
  assert.match(userFacingError(new Error('Failed to fetch')), /Không thể kết nối máy chủ/)
  assert.match(userFacingError(new BackendError(504)), /phản hồi quá lâu/)
})

test('freezes generic transport/status copy for every supported failure class', () => {
  assert.match(userFacingError(new BackendError(403)), /không có quyền/)
  assert.match(userFacingError(new BackendError(408)), /phản hồi quá lâu/)
  assert.match(userFacingError(new BackendError(502)), /Máy chủ đang gặp sự cố/)
  assert.match(userFacingError(new Error('connection refused')), /Không thể kết nối máy chủ/)
  assert.equal(userFacingError({ message: 'error.http.418' }, 'fallback'), 'fallback')
  assert.equal(userFacingError({ message: 'unknown error' }, 'fallback'), 'fallback')
})

test('treats Safari load failures as transport errors but not failed uploads', () => {
  assert.match(userFacingError(new Error('Load failed')), /Không thể kết nối máy chủ/)
  assert.doesNotMatch(userFacingError(new Error('upload failed')), /Không thể kết nối máy chủ/)
})
test('maps access, missing data and validation failures', () => {
  assert.match(userFacingError(new BackendError(401)), /đăng nhập lại/)
  assert.match(userFacingError(new BackendError(404)), /Không tìm thấy dữ liệu/)
  assert.match(userFacingError(new BackendError(422, { fieldErrors: [{ field: 'receiver', message: 'required' }] })), /Người nhập: required/)
})
test('renders actionable Vietnamese field messages from Entry domain errors', () => {
  assert.equal(userFacingError(new BackendError(400, { code: 'MSG-COM-06', params: { field: 'weightBasis' }, message: 'Vui lòng nhập weightBasis.' })), 'Vui lòng nhập Cơ sở cân.')
  assert.equal(userFacingError(new BackendError(400, { code: 'MSG-COM-06', params: { field: 'note' }, message: 'Vui lòng nhập note.' })), 'Vui lòng nhập Ghi chú.')
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
})

test('freezes current feature message mappings and field labels', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['MSG-COM-08', { field: 'purposeId' }, 'Mục đích nuôi đã chọn không còn khả dụng. Vui lòng chọn lại.'],
    ['MSG-FE04-05', { pen_code: 'A1', count: 2, free: 1 }, 'Chuồng A1 không đủ chỗ nhận 2 con (còn 1 chỗ).'],
    ['MSG-FE04-06', { pen_code: 'A1', criteria: 'cần bò cái' }, 'Chuồng A1 chưa phù hợp với tiêu chí: cần bò cái.'],
    ['MSG-FE05-02', { ear_tag: 'E-1' }, 'Số tai E-1 đã được dùng cho một bò đang nuôi của trại.'],
    ['MSG-FE05-03', {}, 'Chỉ Chủ trại mới đổi được mục đích sản xuất.'],
    ['MSG-FE06-03', {}, 'Ngày nhập không được ở tương lai hoặc trước ngày sinh.'],
    ['MSG-FE06-13', { amount: 100000 }, 'Số tiền thanh toán không được vượt quá 100000 đ.'],
    ['MSG-FE12-08', {}, 'Mã thẻ này đã được dùng cho một thẻ khác. Hãy nhập mã khác hoặc để hệ thống tạo mã.'],
    ['MSG-FE21-08', {}, 'Giao dịch ngân hàng này đã được ghi nhận ở một khoản khác. Hãy chọn chứng từ khác.'],
    ['MSG-FE21-09', {}, 'Số tiền phải là số nguyên VND lớn hơn 0.'],
    ['MSG-FE21-10', { category: 'Thuốc', type: 'INCOME' }, 'Danh mục Thuốc không dùng được cho Thu.'],
    ['MSG-FE21-12', {}, 'Kết quả báo cáo đã hết hạn. Hãy chạy lại báo cáo.'],
  ]
  for (const [code, params, expected] of cases) {
    assert.equal(userFacingError(new BackendError(422, { code, params, message: 'error.validation' })), expected)
  }
})

test('uses a shared message for version conflicts across features', () => {
  assert.equal(
    userFacingError(new BackendError(409, { code: 'MSG-COM-05', message: 'error.validation' })),
    'Dữ liệu đã thay đổi. Vui lòng tải lại trang rồi thử lại.',
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
