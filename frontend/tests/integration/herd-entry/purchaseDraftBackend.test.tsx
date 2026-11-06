import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const draftVoucher = (status = 'DRAFT', version = 1) => ({
  id: 41, code: 'PN-BACKEND-0041', entryType: 'PURCHASE', status, entryDate: '2026-10-30',
  sellerId: 7, sellerName: 'Trại giống Backend', sellerPhone: '0909000000', quarantineCertNo: 'KD-BACKEND-01',
  vehiclePlate: '29C-001.41', note: 'Phiếu backend', pricingBasis: 'PER_HEAD', cattleAmount: 85000,
  transportFee: 0, totalPayable: 85000, amountPaid: 0, outstanding: 85000, paymentMethod: null,
  paymentDueDate: null, version, cattleCount: 1, totalWeightKg: 236,
  lines: [{
    id: 91, lineNo: 1, status: 'DRAFT', cattleCode: null, earTagNumber: 'BC-BACKEND-001',
    entryDate: '2026-10-30', entryWeightKg: 236, weightBasis: 'MEASURED', estimatedWeight: false,
    unitPrice: 85000, lineAmount: 85000, penId: 11, penCode: 'B1', currentHerdStatus: 'DRAFT',
    currentPenId: null, currentPenCode: null, version: 1,
    data: { name: 'Bò backend', breedId: 2, breedName: 'Brahman lai', sex: 'FEMALE', birthDate: '2025-10-01',
      birthDateAccuracy: 'EXACT', lifeStage: 'ADULT', purposeId: 31, purposeName: 'Vỗ béo', purposeType: 'FATTENING',
      entryWeightKg: 236, weightBasis: 'MEASURED', unitPrice: 85000 },
  }],
  payments: [], history: [],
})

// The server stores the requested ear tag on its own line view (with catalogue names).
const storedLines = (body: unknown) => draftVoucher().lines.map((line, index) => ({ ...line, earTagNumber: ((body as { lines?: Array<{ earTagNumber?: string }> }).lines?.[index]?.earTagNumber) ?? line.earTagNumber }))

describe('purchase entry page in backend mode', () => {
  let serverVoucher: ReturnType<typeof draftVoucher> | null = null
  const requests: Array<{ method: string; path: string; body?: unknown }> = []

  beforeEach(() => {
    requests.length = 0
    serverVoucher = null
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
    localStorage.setItem('beefcare:latency', '0')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://backend.test')
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      requests.push({ method, path: url.pathname, body })
      if (url.pathname === '/api/farms/9/entry-vouchers' && method === 'GET') return response({ items: serverVoucher ? [serverVoucher] : [] })
      if (url.pathname === '/api/farms/9/entry-vouchers' && method === 'POST') {
        serverVoucher = { ...draftVoucher(), ...(body as object), lines: storedLines(body), version: 1 }
        return response(serverVoucher)
      }
      if (url.pathname === '/api/farms/9/entry-vouchers/41' && method === 'GET') return response(serverVoucher ?? draftVoucher())
      if (url.pathname === '/api/farms/9/entry-vouchers/41' && method === 'PUT') {
        serverVoucher = { ...draftVoucher(), ...(body as object), lines: storedLines(body), status: 'DRAFT', version: 2 }
        return response(serverVoucher)
      }
      if (url.pathname === '/api/farms/9/entry-vouchers/41/attachments' && method === 'GET') {
        return response(serverVoucher ? [{ id: 71, originalFilename: 'purchase.pdf', contentType: 'application/pdf', fileSize: 3 }] : [])
      }
      if (url.pathname === '/api/farms/9/entry-vouchers/41/attachments' && method === 'POST') return response({ id: 71, originalFilename: 'purchase.pdf', contentType: 'application/pdf', fileSize: 3 })
      if (url.pathname === '/api/farms/9/entry-vouchers/41/post' && method === 'POST') {
        serverVoucher = { ...(serverVoucher ?? draftVoucher()), status: 'POSTED', version: 3 }
        return response(serverVoucher)
      }
      if (url.pathname === '/api/farms/9/pens') return response({ pens: [{ id: 11, code: 'B1', name: 'B1 – Vỗ béo', headcount: 4, capacity: 20, status: 'ACTIVE' }] })
      if (url.pathname.endsWith('/catalogues/breeds')) return response([{ id: 2, code: 'BRAHMAN_LAI', name: 'Brahman lai' }])
      if (url.pathname.endsWith('/catalogues/production-purposes')) return response([{ id: 31, code: 'FATTENING', name: 'Vỗ béo', purposeType: 'FATTENING', available: true }])
      if (url.pathname.endsWith('/trading-partners')) return response([{ id: 7, name: 'Trại giống Backend', phone: '0909000000' }])
      if (url.pathname === '/api/farms/9/pending-calves') return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'test-csrf' })
      throw new Error(`Unexpected ${method} ${url.pathname}`)
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('saves a purchase draft, reopens its header/line/document metadata, then posts through the real adapter', async () => {
    const user = userEvent.setup()
    const { default: ImportNew } = await import('../../../src/features/herd-entry/pages/ImportNew')
    const first = render(<MemoryRouter initialEntries={['/herd-entry/new']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)

    await screen.findByDisplayValue('Mua ngoài')
    await user.click(screen.getByRole('button', { name: 'Theo con' }))
    await user.click(screen.getByRole('button', { name: 'Thêm con' }))
    const dialog = screen.getByRole('dialog')
    const comboBoxes = within(dialog).getAllByRole('combobox')
    await user.type(within(dialog).getAllByRole('textbox')[0], 'BC-BACKEND-001')
    await user.selectOptions(comboBoxes[0], 'Brahman lai')
    const numberInputs = within(dialog).getAllByRole('spinbutton')
    await user.clear(numberInputs[0])
    await user.type(numberInputs[0], '236')
    // Per head: the line amount field replaces the per-kg unit price.
    const amount = dialog.querySelector('#entry-cow-total-amount') as HTMLInputElement
    await user.clear(amount)
    await user.type(amount, '85000')
    await user.selectOptions(comboBoxes[3], 'B1')
    const selectWith = (option: string) => within(dialog).getAllByRole('combobox').find((select) => within(select).queryByRole('option', { name: option }))!
    await user.selectOptions(selectWith('Bò tơ / hậu bị'), 'Bò tơ')
    await user.selectOptions(selectWith('Bò sinh sản · loại Sinh sản'), 'Bò sinh sản · loại Sinh sản')
    await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
    const file = new File(['pdf'], 'purchase.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), file)
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path === '/api/farms/9/entry-vouchers')).toBe(true))
    expect(requests.find((request) => request.method === 'POST' && request.path === '/api/farms/9/entry-vouchers')?.body).toMatchObject({ entryType: 'PURCHASE', pricingBasis: 'PER_HEAD' })
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/attachments'))).toBe(true))

    first.unmount()
    render(<MemoryRouter initialEntries={['/herd-entry/new?id=PN-BACKEND-0041']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)
    expect(await screen.findByDisplayValue('PN-BACKEND-0041')).toBeInTheDocument()
    expect(screen.getByText('BC-BACKEND-001')).toBeInTheDocument()
    expect(screen.getByText('purchase.pdf')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Người nhập' }), 'Anh A')
    await user.click(screen.getByRole('button', { name: /Lưu & tạo hồ sơ 1 con/ }))
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/post'))).toBe(true))
    expect(serverVoucher?.status).toBe('POSTED')
  }, 20000)
})
