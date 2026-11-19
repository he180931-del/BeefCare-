import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const response = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init })

describe('Cattle backend errors', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.setItem('beefcare:latency', '0')
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders a list retry action after a backend 500 and recovers on retry', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/cattle')) {
        attempts += 1
        return attempts === 1 ? response({ message: 'down' }, { status: 500 }) : response({ items: [{ id: 1, displayCode: 'BC-RETRY-001', herdStatus: 'ACTIVE' }], total: 1, page: 0, size: 25, counts: { ACTIVE: 1 } })
      }
      if (url.pathname.endsWith('/pens')) return response({ pens: [] })
      if (url.pathname.endsWith('/catalogues/production-purposes') || url.pathname.endsWith('/catalogues/breeds')) return response([])
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })
    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    render(<MemoryRouter><CowList /></MemoryRouter>)

    expect(await screen.findByText('Không tải được danh sách đàn bò.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('BC-RETRY-001')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('renders a profile retry action after a backend 403 and recovers on retry', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/cattle/resolve')) {
        attempts += 1
        if (attempts === 1) return response({ message: 'forbidden' }, { status: 403 })
        return response({ cattleId: 5 })
      }
      if (url.pathname.endsWith('/cattle/5')) return response({ id: 5, displayCode: 'BC-PROFILE-RETRY', herdStatus: 'ACTIVE' })
      if (url.pathname.endsWith('/cattle/5/pen-history')) return response({ current: null, history: [] })
      if (url.pathname.endsWith('/cattle/5/qr-tags') || url.pathname.endsWith('/cattle/5/timeline')) return response([])
      if (url.pathname.endsWith('/pens')) return response({ pens: [] })
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })
    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    render(<MemoryRouter initialEntries={['/cattle/BC-PROFILE-RETRY']}><Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('Không tải được hồ sơ bò BC-PROFILE-RETRY.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }))
    expect((await screen.findAllByText(/BC-PROFILE-RETRY/)).length).toBeGreaterThan(0)
    expect(attempts).toBe(2)
  })
})
