import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backendCattle = {
  items: [{
    id: 991, displayCode: 'BC-BACKEND-PURPOSE-001', earTagNumber: 'TAG-991', name: 'Bông Backend', sex: 'FEMALE',
    birthDate: '2024-01-02', birthDateAccuracy: 'EXACT', breedId: 21, breedName: 'Brahman', purposeId: 31, purposeName: 'Vỗ béo', purposeType: 'FATTENING',
    lifeStage: 'ADULT', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', version: 2, penId: 11, penCode: 'A1',
    penName: 'Chuồng A1', latestWeightKg: 320, weightBasis: 'MEASURED', healthState: 'HEALTHY',
    reproductiveStatus: 'NOT_APPLICABLE', penSince: '2024-01-05', exitPending: false, withdrawalActive: false,
  }],
  total: 1, page: 0, size: 25, counts: { ACTIVE: 1, EXITED: 0, VOIDED: 0, FATTENING: 1 },
}

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
const requestedCattleUrls: string[] = []

describe('CowList backend mode — SCR-18 Purpose filter', () => {
  beforeEach(() => {
    requestedCattleUrls.length = 0
    localStorage.setItem('beefcare:latency', '0')
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/catalogues/production-purposes')) return response([{ id: 31, code: 'FATTENING', name: 'Vỗ béo', purposeType: 'FATTENING', available: true }, { id: 32, code: 'BREEDING', name: 'Bò sinh sản', purposeType: 'BREEDING', available: true }])
      if (url.pathname.endsWith('/cattle')) {
        requestedCattleUrls.push(url.toString())
        const purposeId = url.searchParams.get('purposeId')
        if (purposeId === '32') return response({ items: [], total: 0, page: 0, size: 25, counts: {} })
        return response({ ...backendCattle, ...(purposeId === '31' ? { total: 1, counts: { ACTIVE: 1, FATTENING: 1 } } : {}) })
      }
      if (url.pathname.endsWith('/pens')) return response({ pens: [{ id: 11, code: 'A1', name: 'Chuồng A1', count: 1, capacity: 3, status: 'ACTIVE', cows: [] }] })
      if (url.pathname.includes('/catalogues/')) throw new Error(`Unexpected catalogue request ${url.pathname}`)
      if (url.pathname.includes('/cattle')) throw new Error(`Unexpected cattle request ${url.pathname}`)
      return response({})
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders a backend-only cattle row and excludes/includes it through Purpose', async () => {
    const user = userEvent.setup()
    vi.resetModules()
    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    render(<MemoryRouter><CowList /></MemoryRouter>)

    expect(await screen.findByText('BC-BACKEND-PURPOSE-001')).toBeInTheDocument()
    const purpose = screen.getByRole('combobox', { name: /Mục đích/i }) as HTMLSelectElement
    const exclude = [...purpose.options].find((option) => option.textContent?.includes('Bò sinh sản'))
    const include = [...purpose.options].find((option) => option.textContent?.includes('Vỗ béo'))
    if (!exclude || !include) throw new Error('Purpose options are missing from the user-visible filter')
    await user.selectOptions(purpose, exclude.value)
    await screen.findByText('Không có bò nào khớp bộ lọc')
    expect(screen.queryByText('BC-BACKEND-PURPOSE-001')).not.toBeInTheDocument()
    expect(requestedCattleUrls.some((url) => new URL(url).searchParams.get('purposeId') === '32')).toBe(true)
    await user.selectOptions(purpose, include.value)
    expect(await screen.findByText('BC-BACKEND-PURPOSE-001')).toBeInTheDocument()
    expect(requestedCattleUrls.some((url) => new URL(url).searchParams.get('purposeId') === '31')).toBe(true)
  })
})
