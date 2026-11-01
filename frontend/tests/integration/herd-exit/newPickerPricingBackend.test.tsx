import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { todayIso } from '../../../src/features/herd-exit/data/exportsData'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('herd-exit new voucher backend picker and pricing flow', () => {
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

  it('selects only backend cattle, enters per-head price, then saves/checks/acknowledges/confirms', async () => {
    const requests: Array<{ method: string; path: string; body?: unknown }> = []
    let saved = false
    const voucher = {
      id: 88, code: 'PX-2026-0001', exitType: 'SALE', status: saved ? 'DRAFT' : 'DRAFT', exitDate: '2026-10-22',
      buyer: { id: 8, label: 'Lò mổ Hà Đông', phone: '0902000000' }, pricingBasis: 'PER_HEAD', version: 1,
      cattleCount: 1, totalWeightKg: 512, lines: [{ cattleId: 991, cattleCode: 'BC-BACKEND-ONLY', earTagNumber: 'TAG-991', breedName: 'Brahman', sex: 'FEMALE', exitWeightKg: 512, penCode: 'C9', unitPrice: 750000 }],
    }
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://backend.test')
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
      requests.push({ method, path: url.pathname, body })
      if (url.pathname === '/api/csrf') return response({ token: 'test-csrf' })
      if (url.pathname === '/api/farms/1/exit-vouchers' && method === 'GET') return response({ vouchers: saved ? [voucher] : [] })
      if (url.pathname === '/api/farms/1/exit-vouchers/selectable-cattle') return response([{
        cattleId: 991, cattleCode: 'BC-BACKEND-ONLY', earTagNumber: 'TAG-991', breedName: 'Brahman', sex: 'FEMALE', ageMonths: 31,
        herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT', penCode: 'C9', penCount: 7, penCapacity: 10, latestWeight: { weightKg: 512, basis: 'MEASURED', date: '2026-10-20' },
      }, {
        cattleId: 992, cattleCode: 'BC-BACKEND-FATTENING', earTagNumber: 'TAG-992', breedName: 'Brahman', sex: 'MALE', ageMonths: 20,
        herdGroup: 'FATTENING', lifeStage: 'YOUNG_STOCK', penCode: 'C9', latestWeight: { weightKg: 400, basis: 'MEASURED', date: '2026-10-20' },
      }])
      if (url.pathname === '/api/farms/1/trading-partners') return response([{ id: 8, name: 'Lò mổ Hà Đông', phone: '0902000000' }])
      if (url.pathname === '/api/farms/1/exit-vouchers' && method === 'POST') { saved = true; return response(voucher) }
      if (url.pathname === '/api/farms/1/exit-vouchers/88/checks') return response({ voucherId: 88, code: voucher.code, version: 1, exitDate: voucher.exitDate, cattle: [{ cattleId: 991, cattleCode: 'BC-BACKEND-ONLY', penId: 9, penCode: 'C9', hasWarnings: false, messages: [] }], occupancy: [] })
      if (url.pathname === '/api/farms/1/exit-vouchers/88/confirm') return response({ voucher: { ...voucher, status: 'CONFIRMED', version: 2 } })
      if (url.pathname === '/api/farms/1/exit-vouchers/88/attachments' && method === 'GET') return response([])
      throw new Error(`Unexpected ${method} ${url.pathname}`)
    })

    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /><Route path="/herd-exit" element={<p>navigated</p>} /></Routes></MemoryRouter>)

    await screen.findByText('1. Thông tin phiếu')
    expect(screen.getByDisplayValue('Tự động khi lưu')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Chọn ngày')[0]).toHaveValue(todayIso())
    expect(screen.queryByRole('button', { name: 'Quét QR' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Chọn bò' }))
    expect(screen.getByText('Chuồng C9: 7/10 con')).toBeInTheDocument()
    expect(screen.queryByText('BC-000203')).not.toBeInTheDocument()
    expect(screen.getByText('Bò cái sinh sản')).toBeInTheDocument()
    const combos = screen.getAllByRole('combobox')
    const barn = combos.at(-3)!
    await user.selectOptions(barn, 'C9')
    expect(barn).toHaveValue('C9')
    const group = screen.getAllByRole('combobox').at(-2)!
    await user.selectOptions(group, 'BREEDING_FEMALES')
    expect(group).toHaveValue('BREEDING_FEMALES')
    expect(screen.getByLabelText('BC-BACKEND-ONLY')).toBeInTheDocument()
    expect(screen.queryByLabelText('BC-BACKEND-FATTENING')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('BC-BACKEND-ONLY'))
    await user.click(screen.getByRole('button', { name: 'Thêm 1 con vào phiếu' }))
    const row = await screen.findByRole('row', { name: /BC-BACKEND-ONLY/ })
    await user.click(screen.getByRole('button', { name: 'Theo con' }))
    const priceInput = within(row).getByDisplayValue('0')
    await user.clear(priceInput)
    await user.type(priceInput, '750000')
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    await screen.findByText('Không có cảnh báo')
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: /Xác nhận xuất 1 con/ }))

    expect(await screen.findByText('navigated')).toBeInTheDocument()
    const save = requests.find((request) => request.method === 'POST' && request.path === '/api/farms/1/exit-vouchers')
    expect(save?.body).toMatchObject({ pricingBasis: 'PER_HEAD', lines: [{ cattleId: 991, unitPrice: 750000 }] })
    expect(requests.some((request) => request.path.includes('PX-2026-0001'))).toBe(false)
    const saveIndex = requests.findIndex((request) => request.method === 'POST' && request.path === '/api/farms/1/exit-vouchers')
    const checksIndex = requests.findIndex((request) => request.path === '/api/farms/1/exit-vouchers/88/checks')
    const confirmIndex = requests.findIndex((request) => request.method === 'POST' && request.path === '/api/farms/1/exit-vouchers/88/confirm')
    expect(saveIndex).toBeGreaterThan(-1)
    expect(checksIndex).toBeGreaterThan(saveIndex)
    expect(confirmIndex).toBeGreaterThan(checksIndex)
    const confirm = requests.find((request) => request.method === 'POST' && request.path === '/api/farms/1/exit-vouchers/88/confirm')
    expect(confirm?.body).toEqual({ acknowledged: true, expectedVersion: 1 })
  })
})
