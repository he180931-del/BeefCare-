import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { penError } from '../../../src/features/pen-management/api/penError'
it('maps pen codes and delegates transport errors', () => { expect(penError(new BackendError(422, { code: 'MSG-FE04-05', params: { pen_code: 'A1', count: 2, free: 1 } }), 'fallback')).toContain('A1'); expect(penError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
