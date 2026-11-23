import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { cattleError } from '../../../src/features/cattle/api/cattleError'
it('maps cattle codes and delegates transport errors', () => { expect(cattleError(new BackendError(422, { code: 'MSG-FE05-02', params: { ear_tag: 'E1' } }), 'fallback')).toContain('E1'); expect(cattleError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
