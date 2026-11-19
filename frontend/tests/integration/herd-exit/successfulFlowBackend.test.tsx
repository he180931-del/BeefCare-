import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const draft = {
  id: 61, code: 'PX-2026-0061', exitType: 'SALE', status: 'DRAFT', exitDate: '2026-10-29',
  buyer: { id: 8, label: 'Lò mổ Hà Đông', name: 'Lò mổ Hà Đông', phone: '0902000000' }, transportCertNo: 'VC-61', vehiclePlate: '30H-12345',
  note: 'Bán lứa 1', pricingBasis: 'PER_KG', deductions: 0, depositCollected: 0, cattleCount: 1,
  totalWeightKg: 410, cattleAmount: 32800000, totalReceivable: 32800000, outstanding: 32800000, amountCollected: 0, version: 5,
  lines: [{ id: 71, cattleId: 301, cattleCode: 'BC-000301', earTagNumber: 'VN301', breedName: 'Brahman', sex: 'MALE', exitWeightKg: 410, penCode: 'B1', lineAmount: 32800000, unitPrice: 80000 }],
  payments: [], history: [],
}

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('herd-exit successful backend flow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '1')
    localStorage.setItem('beefcare:latency', '0')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('saves the draft, uploads documents, confirms, and navigates after success', async () => {
    const writes: Array<{ method: string; path: string }> = []
    const requests: string[] = []
    let savedVersion = 5
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://backend.test')
      const method = init?.method ?? 'GET'
      requests.push(`${method} ${url.pathname}`)
      if (url.pathname === '/api/csrf') return response({ token: 'test-csrf' })
      if (url.pathname === '/api/farms/1/exit-vouchers' && method === 'GET') return response({ vouchers: [{ ...draft, version: savedVersion }] })
      if (url.pathname === '/api/farms/1/exit-vouchers/61' && method === 'GET') return response({ ...draft, version: savedVersion })
      if (url.pathname === '/api/farms/1/exit-vouchers/61/attachments' && method === 'GET') return response([])
      if (url.pathname === '/api/farms/1/exit-vouchers/61/checks' && method === 'GET') return response({ voucherId: 61, code: draft.code, version: savedVersion, exitDate: draft.exitDate, cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Ngưng giết mổ đến 31/10/2026' }] }], occupancy: [{ penId: 11, penCode: 'B1', capacity: 10, before: 1, after: 0 }] })
      if (url.pathname === '/api/farms/1/exit-vouchers/selectable-cattle') return response([{ cattleId: 301, cattleCode: 'BC-000301', earTagNumber: 'VN301', breedName: 'Brahman', sex: 'MALE', penCode: 'B1', latestWeight: { weightKg: 410, basis: 'MEASURED', date: '2026-10-20' } }])
      if (url.pathname === '/api/farms/1/trading-partners') return response([{ id: 8, name: 'Lò mổ Hà Đông', phone: '0902000000' }])
      if (url.pathname === '/api/farms/1/exit-vouchers/61' && method === 'PUT') {
        writes.push({ method, path: url.pathname })
        savedVersion = 6
        return response({ ...draft, version: savedVersion })
      }
      if (url.pathname === '/api/farms/1/exit-vouchers/61/attachments' && method === 'POST') {
        writes.push({ method, path: url.pathname })
        return response({ id: 901, contentType: 'application/pdf', fileSize: 12, originalFilename: 'hop-dong.pdf' })
      }
      if (url.pathname === '/api/farms/1/exit-vouchers/61/confirm' && method === 'POST') {
        writes.push({ method, path: url.pathname })
        expect(JSON.parse(String(init?.body))).toMatchObject({ acknowledged: true, expectedVersion: savedVersion })
        return response({ voucher: { ...draft, status: 'CONFIRMED', version: 7 } })
      }
      throw new Error(`Unexpected ${method} ${url.pathname}`)
    })

    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/herd-exit/new?id=PX-2026-0061']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /><Route path="/herd-exit" element={<p>navigated</p>} /></Routes></MemoryRouter>)

    expect((await screen.findAllByRole('row', { name: /BC-000301/ }))[0]).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), new File(['%PDF'], 'hop-dong.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    expect(await screen.findByText('Ngưng giết mổ đến 31/10/2026')).toBeInTheDocument()
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: /Xác nhận xuất 1 con/ }))

    expect(await screen.findByText('navigated')).toBeInTheDocument()
    expect(requests.indexOf('PUT /api/farms/1/exit-vouchers/61')).toBeLessThan(requests.indexOf('GET /api/farms/1/exit-vouchers/61/checks'))
    expect(requests.indexOf('GET /api/farms/1/exit-vouchers/61/checks')).toBeGreaterThan(-1)
    expect(requests.indexOf('GET /api/farms/1/exit-vouchers/61/checks')).toBeLessThan(requests.indexOf('POST /api/farms/1/exit-vouchers/61/confirm'))
    expect(writes).toEqual([
      { method: 'PUT', path: '/api/farms/1/exit-vouchers/61' },
      { method: 'POST', path: '/api/farms/1/exit-vouchers/61/attachments' },
      { method: 'POST', path: '/api/farms/1/exit-vouchers/61/confirm' },
    ])
  })
})
