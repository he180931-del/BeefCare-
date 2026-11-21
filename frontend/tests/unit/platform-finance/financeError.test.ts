import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { financeError } from '../../../src/features/platform-finance/api/financeError'
it('maps finance codes and delegates transport errors', () => { expect(financeError(new BackendError(422, { code: 'MSG-FE21-09' }), 'fallback')).toContain('VND'); expect(financeError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
