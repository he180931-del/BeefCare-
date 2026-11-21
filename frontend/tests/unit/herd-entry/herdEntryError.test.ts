import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { herdEntryError } from '../../../src/features/herd-entry/api/herdEntryError'
it('maps entry codes and delegates transport errors', () => { expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-13', params: { amount: 10 } }), 'fallback')).toContain('10'); expect(herdEntryError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
