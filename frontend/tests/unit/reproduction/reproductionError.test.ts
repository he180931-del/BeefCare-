import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { reproductionError } from '../../../src/features/reproduction/api/reproductionError'
it('maps reproduction tag conflict and delegates transport errors', () => { expect(reproductionError(new BackendError(422, { code: 'MSG-FE12-08' }), 'fallback')).toContain('Mã thẻ'); expect(reproductionError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
