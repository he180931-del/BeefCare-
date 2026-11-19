import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('cattle list herd statuses', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname.endsWith('/cattle')) return response({ items: [
        { id: 1, displayCode: 'BC-ACTIVE', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', purposeName: 'Vỗ béo', lifeStage: 'ADULT', sex: 'MALE' },
        { id: 2, displayCode: 'BC-PENDING', herdStatus: 'EXIT_PENDING', herdGroup: 'FATTENING', purposeName: 'Vỗ béo', lifeStage: 'ADULT', sex: 'MALE' },
        { id: 3, displayCode: 'BC-EXITED', herdStatus: 'EXITED', herdGroup: 'FATTENING', purposeName: 'Vỗ béo', lifeStage: 'ADULT', sex: 'MALE' },
        { id: 4, displayCode: 'BC-VOIDED', herdStatus: 'VOIDED', herdGroup: 'FATTENING', purposeName: 'Vỗ béo', lifeStage: 'ADULT', sex: 'MALE' },
      ], total: 4, page: 0, size: 25, counts: { ACTIVE: 1, EXIT_PENDING: 1, EXITED: 1, VOIDED: 1 } })
      if (url.pathname.endsWith('/pens')) return response({ pens: [] })
      if (url.pathname.endsWith('/catalogues/production-purposes')) return response([])
      if (url.pathname.endsWith('/catalogues/breeds')) return response([])
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders ACTIVE, EXIT_PENDING, EXITED and VOIDED as user-facing statuses', async () => {
    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    render(<MemoryRouter><CowList /></MemoryRouter>)
    expect(await screen.findByText('BC-ACTIVE')).toBeInTheDocument()
    const activeRow = screen.getByText('BC-ACTIVE').closest('tr') as HTMLElement
    expect(activeRow).toHaveTextContent('—')
    expect(activeRow).not.toHaveTextContent(/Chờ xuất|Đã xuất|Đã hủy/)
    expect(screen.getByText('Chờ xuất')).toBeInTheDocument()
    expect(screen.getByText('Đã xuất')).toBeInTheDocument()
    expect(screen.getByText('Đã hủy')).toBeInTheDocument()
  })
})
