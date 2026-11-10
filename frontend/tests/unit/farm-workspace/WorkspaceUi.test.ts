import { describe, expect, it } from 'vitest'
import { BackendError } from '../../../src/api/backendClient'
import { farmWorkspaceError } from '../../../src/features/farm-workspace/components/WorkspaceUi'

describe('farm workspace server validation messages', () => {
  it('translates contact phone pattern violations into Vietnamese', () => {
    const error = new BackendError(400, {
      message: 'error.validation',
      fieldErrors: [{ field: 'contactPhone', message: 'must match "^(?:0|\\\\+84)[0-9]{9,10}$"' }],
    })

    expect(farmWorkspaceError(error, 'Không thể lưu.')).toBe('Điện thoại liên hệ: Nhập số điện thoại Việt Nam hợp lệ.')
  })
})
