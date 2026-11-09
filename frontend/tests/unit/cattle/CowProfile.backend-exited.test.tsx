import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backendProfile = {
  id: 992, displayCode: 'BC-BACKEND-EXITED-001', earTagNumber: 'TAG-992', name: 'Bò xuất backend', sex: 'FEMALE',
  birthDate: '2022-05-12', birthDateAccuracy: 'EXACT', breedId: 21, breedName: 'Brahman', purposeId: 31, purposeName: 'Vỗ béo', purposeType: 'FATTENING', lifeStage: 'ADULT',
  herdStatus: 'EXITED', herdGroup: 'FATTENING', version: 4, penId: null, penCode: null, penName: null,
  latestWeightKg: 498, weightBasis: 'MEASURED', healthState: null, reproductiveStatus: null,
  exitPending: false, withdrawalActive: false, exitType: 'SALE', exitDate: '2026-10-20', canUpdate: false,
}

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('CowProfile backend mode — exited cattle', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.setItem('beefcare:latency', '0')
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/cattle/resolve') && url.searchParams.get('code') === 'BC-BACKEND-EXITED-001') return response({ farmId: 9, cattleId: 992, switchFarmRequired: false, replacedTag: false, cattle: backendProfile, messageCode: null })
      if (url.pathname.endsWith('/cattle/992')) return response(backendProfile)
      if (url.pathname.endsWith('/cattle/992/pen-history')) return response({ cattleId: 992, cattleCode: 'BC-BACKEND-EXITED-001', herdStatus: 'EXITED', current: null, history: [{ penCode: 'A1', fromDate: '2024-01-01', toDate: '2026-10-20', reason: 'Xuất đàn', by: 'Chủ trại' }] })
      if (url.pathname.endsWith('/cattle/992/qr-tags')) return response([{ id: 9921, tagCode: 'QR-EXITED-REAL', status: 'ACTIVE', displayCode: 'BC-BACKEND-EXITED-001', issuedAt: '2024-01-01T08:00:00Z', endedAt: null, reason: 'FIRST_ISSUE', version: 1 }])
      if (url.pathname.endsWith('/cattle/992/timeline')) return response([{ category: 'ENTRY_EXIT', type: 'HERD_EXIT', sourceId: 99, occurredAt: '2026-10-20T08:00:00Z', recordedAt: '2026-10-20T08:01:00Z', recorder: 'Chủ trại', status: 'CONFIRMED', corrected: false, values: { exitType: 'SALE' } }])
      if (url.pathname.includes('/pens')) return response({ pens: [{ id: 11, code: 'A1', name: 'Chuồng A1', count: 0, capacity: 3, status: 'ACTIVE', cows: [] }] })
      if (url.pathname.includes('/cattle')) throw new Error(`Unexpected cattle request ${url.pathname}`)
      throw new Error(`Unexpected backend request ${url.pathname}${url.search}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders backend-only identity and keeps exited cattle read-only while retaining history tabs', async () => {
    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    render(
      <MemoryRouter initialEntries={['/cattle/BC-BACKEND-EXITED-001']}>
        <Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText(/BC-BACKEND-EXITED-001/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Bò xuất backend/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Đã xuất · Bán · 20\/10\/2026/)).toBeInTheDocument()
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cập nhật hồ sơ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Cấp lại QR|Cấp QR|Cấp thẻ|Thay thẻ)$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chuyển chuồng' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dòng thời gian' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lịch sử chuồng' }))
    expect(screen.getByRole('button', { name: 'Lịch sử chuồng' })).toBeInTheDocument()
    expect(screen.getByText('20/10/2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chuyển chuồng' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thẻ QR' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thẻ QR' }))
    expect((await screen.findAllByText('QR-EXITED-REAL')).length).toBeGreaterThan(0)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dòng thời gian' }))
    expect(await screen.findByText('Xuất đàn – Bán')).toBeInTheDocument()
  })

  it.each([{ canUpdate: true, actions: true }, { canUpdate: false, actions: false }])('exposes backend ACTIVE actions only when canUpdate=%s', async ({ canUpdate, actions }) => {
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    writes.mockClear()
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/cattle/resolve')) return response({ farmId: 9, cattleId: 993, switchFarmRequired: false, replacedTag: false, cattle: { ...backendProfile, id: 993, displayCode: 'BC-BACKEND-ACTIVE-001', herdStatus: 'ACTIVE', canUpdate }, messageCode: null })
      if (url.pathname.endsWith('/cattle/993')) return response({ ...backendProfile, id: 993, displayCode: 'BC-BACKEND-ACTIVE-001', herdStatus: 'ACTIVE', canUpdate })
      if (url.pathname.endsWith('/cattle/993/pen-history')) return response({ current: null, history: [] })
      if (url.pathname.endsWith('/cattle/993/qr-tags') || url.pathname.endsWith('/cattle/993/timeline')) return response([])
      if (url.pathname.includes('/pens')) return response({ pens: [] })
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })
    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    render(<MemoryRouter initialEntries={['/cattle/BC-BACKEND-ACTIVE-001']}><Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes></MemoryRouter>)

    expect((await screen.findAllByText(/BC-BACKEND-ACTIVE-001/)).length).toBeGreaterThan(0)
    if (actions) {
      expect(screen.getByRole('button', { name: 'Cập nhật hồ sơ' })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^(Cấp lại QR|Cấp QR|Cấp thẻ|Thay thẻ)$/ }).length).toBeGreaterThan(0)
    } else {
      expect(screen.queryByRole('button', { name: 'Cập nhật hồ sơ' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^(Cấp lại QR|Cấp QR|Cấp thẻ|Thay thẻ)$/ })).not.toBeInTheDocument()
    }
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lịch sử chuồng' }))
    if (actions) expect(screen.getByRole('button', { name: 'Chuyển chuồng' })).toBeInTheDocument()
    else expect(screen.queryByRole('button', { name: 'Chuyển chuồng' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thẻ QR' }))
    if (actions) expect(screen.getAllByRole('button', { name: /^(Cấp lại QR|Cấp QR|Cấp thẻ|Thay thẻ)$/ }).length).toBeGreaterThan(0)
    else expect(screen.queryByRole('button', { name: /^(Cấp lại QR|Cấp QR|Cấp thẻ|Thay thẻ)$/ })).not.toBeInTheDocument()
    expect(writes).not.toHaveBeenCalled()
    writes.mockRestore()
  })
})
