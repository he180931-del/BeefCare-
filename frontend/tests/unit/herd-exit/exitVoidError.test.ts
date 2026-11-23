import { describe, expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { userFacingError } from '../../../src/shared/api/userFacingError'
import { exitVoidError } from '../../../src/features/herd-exit/api/exitVoidError'

describe('exit void domain errors', () => {
  it.each(['MSG-FE13-09', 'MSG-FE04-06', 'MSG-COM-06'])('preserves the translated server message for %s', (code) => {
    expect(exitVoidError(new BackendError(422, { code, message: 'Thông báo nghiệp vụ cụ thể từ máy chủ.' }))).toBe('Thông báo nghiệp vụ cụ thể từ máy chủ.')
  })
  it.each([
    ['MSG-FE13-09', { pen: 'B2' }, 'Chuồng B2 không khả dụng hoặc không đủ chỗ. Hãy chọn chuồng cho từng con trước khi hủy.'],
    ['MSG-FE04-06', { cattle_code: 'BC-1', pen_code: 'B2', criteria: 'Giới tính Cái' }, 'BC-1 không đạt tiêu chí nhận bò của B2: Giới tính Cái. Nhập lý do để tiếp tục.'],
    ['MSG-COM-06', { field: 'reason' }, 'Vui lòng nhập reason.'],
  ])('formats %s with params if the server message is missing', (code, params, text) => {
    expect(exitVoidError(new BackendError(422, { code, params }))).toBe(text)
  })
  it('leaves generic and version errors to the existing formatter', () => {
    const error = new BackendError(409, { code: 'MSG-COM-05' })
    expect(exitVoidError(error)).toBe(userFacingError(error))
    expect(exitVoidError(new BackendError(500))).toBe(userFacingError(new BackendError(500)))
  })
})
