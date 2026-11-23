import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { catalogueError } from '../../../src/features/farm-catalogue/api/catalogueError'
it('maps inactive catalogue values and delegates transport errors', () => { expect(catalogueError(new BackendError(422, { code: 'MSG-FE18-08', params: { field: 'breed' } }), 'fallback')).toContain('breed'); expect(catalogueError(new BackendError(503), 'fallback')).toContain('Máy chủ') })
