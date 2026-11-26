import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('cattle list dashboard filters', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('opens the herd group selected from the dashboard link', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const requestedGroups: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname.endsWith('/cattle')) {
        const group = url.searchParams.get('herdGroup') ?? ''
        requestedGroups.push(group)
        const rows = [
          { id: 1, displayCode: 'BC-FATTENING', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', purposeName: 'Vỗ béo', lifeStage: 'ADULT', sex: 'MALE' },
          { id: 2, displayCode: 'BC-OTHER', herdStatus: 'ACTIVE', herdGroup: 'OTHER', purposeName: 'Khác', lifeStage: 'ADULT', sex: 'FEMALE' },
        ].filter((row) => !group || row.herdGroup === group)
        return response({ items: rows, total: rows.length, page: 0, size: 25, counts: { ACTIVE: rows.length, FATTENING: 1, OTHER: 1 } })
      }
      if (url.pathname.endsWith('/pens')) return response({ pens: [] })
      if (url.pathname.endsWith('/catalogues/production-purposes')) return response([])
      if (url.pathname.endsWith('/catalogues/breeds')) return response([])
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })

    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    render(<MemoryRouter initialEntries={['/cattle?nhom=FATTENING']}><CowList /></MemoryRouter>)

    expect(await screen.findByText('BC-FATTENING')).toBeInTheDocument()
    expect(requestedGroups).toContain('FATTENING')
    expect(screen.queryByText('BC-OTHER')).not.toBeInTheDocument()
  })
})
