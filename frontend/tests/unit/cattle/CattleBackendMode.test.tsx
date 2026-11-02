import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backendList = {
  items: [{
    id: 901, displayCode: 'BC-BACKEND-001', earTagNumber: 'TAG-001', name: 'Bông', sex: 'FEMALE',
    birthDate: '2024-01-02', birthDateAccuracy: 'EXACT', breedId: 21, breedName: 'Brahman', purposeId: 31, purposeName: 'Vỗ béo', purposeType: 'FATTENING',
    lifeStage: 'ADULT', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', version: 2, penId: 11, penCode: 'A1',
    penName: 'Chuồng A1', latestWeightKg: 320, weightBasis: 'MEASURED', healthState: 'HEALTHY',
    reproductiveStatus: 'NOT_APPLICABLE', penSince: '2024-01-05', exitPending: false, withdrawalActive: false,
  }],
  total: 2,
  page: 0,
  size: 1,
  counts: { ACTIVE: 17, EXITED: 3, VOIDED: 0, FATTENING: 1, BREEDING_FEMALES: 2, BREEDING_BULLS: 1, CALVES: 4, YOUNG_STOCK: 5, OTHER: 4 },
}

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('cattle pages in backend mode', () => {
  const requested: string[] = []
  beforeEach(() => {
    requested.length = 0
    localStorage.setItem('beefcare:latency', '0')
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.resetModules()
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://backend.test')
      if (url.pathname.endsWith('/cattle')) {
        requested.push(url.toString())
        const purposeId = url.searchParams.get('purposeId')
        const page = Number(url.searchParams.get('page') ?? '0')
        if (purposeId === '32') return jsonResponse({ items: [], total: 0, page, size: 25, counts: { ACTIVE: 0, EXITED: 0, VOIDED: 0 } })
        if (page > 0) return jsonResponse({ items: [{ ...backendList.items[0], id: 902, displayCode: 'BC-BACKEND-002', herdStatus: 'EXITED' }], total: 2, page, size: 1, counts: backendList.counts })
        return jsonResponse(backendList)
      }
      if (url.pathname.endsWith('/pens')) return jsonResponse({ pens: [{ id: 11, code: 'A1', name: 'Chuồng A1', count: 1, capacity: 3, status: 'ACTIVE', cows: [] }] })
      if (url.pathname.endsWith('/catalogues/production-purposes')) return jsonResponse([{ id: 31, code: 'FATTENING', name: 'Vỗ béo', purposeType: 'FATTENING', available: true }, { id: 32, code: 'BREEDING', name: 'Bò sinh sản', purposeType: 'BREEDING', available: true }])
      throw new Error(`Unexpected backend request ${url.pathname}${url.search}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders backend rows and applies SCR-18 filter and real pagination counts', async () => {
    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    const user = userEvent.setup()
    render(<MemoryRouter><CowList /></MemoryRouter>)

    expect(await screen.findByText('BC-BACKEND-001')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mã hiển thị, số tai, tên gọi…')).toBeInTheDocument()
    expect(screen.getByText(/Hiển thị 1–1 trong 2/)).toBeInTheDocument()
    expect(screen.getByText(/17 con đang nuôi/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Mục đích/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Sức khỏe/i })).toBeInTheDocument()
    expect(requested.some((url) => new URL(url).searchParams.get('page') === '0')).toBe(true)
    expect(screen.getByText('Đã xuất (3)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(await screen.findByText('BC-BACKEND-002')).toBeInTheDocument()
    expect(requested.some((url) => new URL(url).searchParams.get('page') === '1')).toBe(true)
    const purpose = screen.getByRole('combobox', { name: /Mục đích/i }) as HTMLSelectElement
    const exclude = [...purpose.options].find((option) => option.textContent?.includes('Bò sinh sản'))
    if (!exclude) throw new Error('Purpose options are missing from the backend catalogue')
    await user.selectOptions(purpose, exclude.value)
    await screen.findByText('Không có bò nào khớp bộ lọc')
    expect(requested.some((url) => new URL(url).searchParams.get('purposeId') === '32')).toBe(true)
  })

  it('uses the backend herd-group contract for every herd tab and exposes herd status filtering', async () => {
    const { default: CowList } = await import('../../../src/features/cattle/pages/CowList')
    const user = userEvent.setup()
    render(<MemoryRouter><CowList /></MemoryRouter>)
    await screen.findByText('BC-BACKEND-001')

    const cattleUrls = () => requested.filter((url) => new URL(url).pathname.endsWith('/cattle'))
    const lastCattleUrl = () => new URL(cattleUrls().at(-1)!, 'http://backend.test')
    const assertGroup = async (label: RegExp, expected: string) => {
      await user.click(screen.getByRole('button', { name: label }))
      await waitFor(() => expect(lastCattleUrl().searchParams.get('herdGroup')).toBe(expected))
    }

    await assertGroup(/Bò cái sinh sản/, 'BREEDING_FEMALES')
    await assertGroup(/Bò tơ/, 'YOUNG_STOCK')
    await assertGroup(/Vỗ béo/, 'FATTENING')
    await assertGroup(/Đực giống/, 'BREEDING_BULLS')
    await assertGroup(/Khác/, 'OTHER')
    await user.click(screen.getByRole('button', { name: /Tất cả/ }))
    const stage = screen.getByRole('combobox', { name: /Giai đoạn/i })
    expect(screen.queryByRole('option', { name: 'Giai đoạn: Bê' })).not.toBeInTheDocument()
    await user.selectOptions(stage, 'UNWEANED_CALF')
    await waitFor(() => expect(lastCattleUrl().searchParams.get('lifeStage')).toBe('UNWEANED_CALF'))
    await user.selectOptions(stage, 'ALL')
    await user.click(screen.getByRole('button', { name: /Vỗ béo/ }))
    const terminalStatus = screen.getByRole('combobox', { name: /Trạng thái đàn/i })
    await user.selectOptions(terminalStatus, 'VOIDED')
    await waitFor(() => {
      expect(lastCattleUrl().searchParams.get('herdStatus')).toBe('VOIDED')
      expect(lastCattleUrl().searchParams.get('herdGroup')).toBeNull()
    })
    await user.click(screen.getByRole('button', { name: /Đã xuất/ }))
    await waitFor(() => {
      expect(lastCattleUrl().searchParams.get('herdStatus')).toBe('EXITED')
      expect(lastCattleUrl().searchParams.get('herdGroup')).toBeNull()
    })

    const status = screen.getByRole('combobox', { name: /Trạng thái đàn/i })
    await user.selectOptions(status, 'VOIDED')
    await waitFor(() => expect(lastCattleUrl().searchParams.get('herdStatus')).toBe('VOIDED'))
    await user.selectOptions(status, 'ALL')
    await waitFor(() => expect(lastCattleUrl().searchParams.get('herdStatus')).toBe('ALL'))
  })

})
