import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QrReissueModal from '../../../src/features/cattle/components/QrReissueModal'
import { initialCows } from '../../../src/data/cowsData'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('QR reissue modal', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      throw new Error(`Unexpected request ${url.pathname}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not offer printing a placeholder QR before the backend returns a tag code', () => {
    const cow = { ...initialCows[0], backendId: 42, backendVersion: 7 }
    render(<QrReissueModal cow={cow} onClose={() => undefined} onSaved={() => undefined} />)

    expect(screen.getByRole('button', { name: 'In thẻ thử' })).toBeDisabled()
  })

  it('does not inject a seed-specific note into a backend profile', () => {
    const cow = { ...initialCows[0], code: 'BC-000125', backendId: 42, backendVersion: 7 }
    render(<QrReissueModal cow={cow} onClose={() => undefined} onSaved={() => undefined} />)

    expect(screen.getAllByRole('textbox')[2]).toHaveValue('')
  })

})
