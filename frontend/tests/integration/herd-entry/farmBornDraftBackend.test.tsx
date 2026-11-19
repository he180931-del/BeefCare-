import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const pendingCalf = {
  calfOutcomeId: 501, calvingId: 401, damId: 125, damCode: 'BC-000125', damActive: true,
  sireCode: 'Không rõ', sex: 'FEMALE', birthDate: '2026-10-29', birthWeightKg: 32,
  tagCode: 'VN-ENTRY-1', proposedPenId: 11, proposedPenCode: 'A3', defaultPurposeId: 2,
  registrationState: 'PENDING_CONFIRMATION', draftVoucherId: 41,
}

const farmBornDraft = {
  id: 41, code: 'PN-2026-0041', entryType: 'FARM_BORN', status: 'DRAFT', entryDate: '2026-10-29',
  sellerId: null, sellerName: null, sellerPhone: null, quarantineCertNo: null, vehiclePlate: null, note: null,
  pricingBasis: null, cattleAmount: 0, transportFee: 0, totalPayable: 0, amountPaid: 0, outstanding: 0,
  paymentMethod: null, paymentDueDate: null, version: 3, cattleCount: 1, totalWeightKg: 32,
  lines: [{
    id: 91, lineNo: 1, status: 'DRAFT', cattleId: null, cattleCode: null, earTagNumber: 'VN-ENTRY-1',
    entryDate: '2026-10-29', entryWeightKg: 32, weightBasis: 'MEASURED', estimatedWeight: false,
    unitPrice: 0, lineAmount: 0, penId: 11, penCode: 'A3', calfOutcomeId: 501, damCode: 'BC-000125',
    currentHerdStatus: 'DRAFT', currentPenId: null, currentPenCode: null, version: 1,
    data: {
      name: 'Bê sinh backend', breedId: null, breedName: null, sex: 'FEMALE', birthDate: '2026-10-29',
      birthDateAccuracy: 'EXACT', lifeStage: 'UNWEANED_CALF', purposeId: 2, purposeName: 'Chưa xác định', purposeType: 'UNDECIDED',
      entryWeightKg: 32, weightBasis: 'MEASURED', unitPrice: 0, calfOutcomeId: 501,
    },
  }],
  payments: [], history: [],
}

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('farm-born entry draft in backend mode', () => {
  const requests: Array<{ method: string; path: string; body?: unknown }> = []
  let serverVoucher: Record<string, unknown>
  let pendingResponse: Record<string, unknown>
  beforeEach(() => {
    requests.length = 0
    serverVoucher = farmBornDraft
    pendingResponse = pendingCalf
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
    localStorage.setItem('beefcare:latency', '0')
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://backend.test')
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      requests.push({ method, path: url.pathname, body })
      if (url.pathname.endsWith('/entry-vouchers/41') && method === 'PUT') {
        const request = body as Record<string, unknown>
        const requestLine = (request.lines as Array<Record<string, unknown>>)[0]
        const oldLine = (farmBornDraft.lines as Array<Record<string, unknown>>)[0]
        const purposeId = Number(requestLine.purposeId)
        const penId = Number(requestLine.penId)
        serverVoucher = {
          ...farmBornDraft,
          ...request,
          version: Number(serverVoucher.version) + 1,
          lines: [{
            ...oldLine,
            calfOutcomeId: requestLine.calfOutcomeId,
            penId,
            penCode: penId === 12 ? 'B1' : 'A3',
            data: {
              ...(oldLine.data as Record<string, unknown>),
              purposeId,
              purposeName: purposeId === 31 ? 'Nuôi thương phẩm' : 'Chưa xác định',
            },
          }],
        }
        return response(serverVoucher)
      }
      if (url.pathname === '/api/farms/9/entry-vouchers') return response({ items: [serverVoucher] })
      if (url.pathname === '/api/farms/9/entry-vouchers/41') return response(serverVoucher)
      if (url.pathname === '/api/farms/9/entry-vouchers/41/attachments') return response([{ id: 71, contentType: 'application/pdf', fileSize: 12, originalFilename: 'kiem-dich.pdf' }])
      if (url.pathname === '/api/farms/9/pens') return response({ pens: [
        { id: 11, code: 'A3', name: 'A3 – Bê theo mẹ', headcount: 5, capacity: 20, status: 'ACTIVE' },
        { id: 12, code: 'B1', name: 'B1 – Nuôi thương phẩm', headcount: 2, capacity: 20, status: 'ACTIVE' },
      ] })
      if (url.pathname.endsWith('/catalogues/breeds')) return response([])
      if (url.pathname.endsWith('/catalogues/production-purposes')) return response([
        { id: 2, code: 'UNDECIDED', name: 'Chưa xác định', purposeType: 'UNDECIDED', available: true },
        { id: 31, code: 'FATTENING', name: 'Nuôi thương phẩm', purposeType: 'FATTENING', available: true },
      ])
      if (url.pathname === '/api/farms/9/pending-calves/501/died-before-registration' && method === 'POST') {
        return response({ ...pendingResponse, registrationState: 'DIED_BEFORE_REGISTRATION', draftVoucherId: null })
      }
      if (url.pathname === '/api/farms/9/pending-calves') return response([pendingResponse])
      if (url.pathname === '/api/farms/9/entry-vouchers/41/post' && method === 'POST') {
        const voucher = {
          ...serverVoucher,
          status: 'POSTED',
          version: 5,
          lines: [{
            ...((serverVoucher.lines as Array<Record<string, unknown>>)[0]),
            status: 'VALID', cattleId: 7001, cattleCode: 'BC-POSTED-0001',
            currentHerdStatus: 'ACTIVE', currentPenId: 11, currentPenCode: 'A3',
          }],
        }
        serverVoucher = voucher
        return response({
          voucher, cattleCodes: ['BC-POSTED-0001'], firstCode: 'BC-POSTED-0001', lastCode: 'BC-POSTED-0001',
          alreadyPosted: false, printQr: Boolean((body as Record<string, unknown>)?.printQr),
          posted: { code: 'FE06-POSTED', params: {}, message: 'Đã nhập đàn' }, warnings: [], matchingSchedules: [], schedulesNotice: null,
        })
      }
      if (url.pathname === '/api/farms/9/trading-partners') return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'test-csrf' })
      throw new Error(`Unexpected ${url.pathname}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('reopens a backend FARM_BORN draft with the pending calf selected and no seller/payment fields', async () => {
    const { default: ImportNew } = await import('../../../src/features/herd-entry/pages/ImportNew')
    render(<MemoryRouter initialEntries={['/herd-entry/new?id=PN-2026-0041&kind=calf']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)

    expect(await screen.findByDisplayValue('Bê sinh tại trại')).toBeInTheDocument()
    const calfCheckbox = screen.getByRole('checkbox', { name: 'Chọn VN-ENTRY-1' })
    expect(calfCheckbox).toBeChecked()
    const calfRow = calfCheckbox.closest('tr')
    expect(calfRow).not.toBeNull()
    expect(calfRow).toHaveTextContent('BC-000125')
    expect(screen.queryByText('Nguồn / chủ bò cũ *')).not.toBeInTheDocument()
    expect(screen.queryByText('Đã thanh toán')).not.toBeInTheDocument()
  })

  it('saves then posts the hydrated FARM_BORN draft and registers its calf without purchase fields', async () => {
    const user = userEvent.setup()
    const { default: ImportNew } = await import('../../../src/features/herd-entry/pages/ImportNew')
    render(<MemoryRouter initialEntries={['/herd-entry/new?id=PN-2026-0041&kind=calf']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)

    await screen.findByDisplayValue('Bê sinh tại trại')
    expect(await screen.findByText('kiem-dich.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu & tạo hồ sơ 1 con' }))
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/entry-vouchers/41/post'))).toBe(true))
    const putIndex = requests.findIndex((request) => request.method === 'PUT' && request.path.endsWith('/entry-vouchers/41'))
    const postIndex = requests.findIndex((request) => request.method === 'POST' && request.path.endsWith('/entry-vouchers/41/post'))
    expect(putIndex).toBeGreaterThanOrEqual(0)
    expect(postIndex).toBeGreaterThan(putIndex)
    const save = requests[putIndex]?.body as Record<string, unknown>
    expect(save.entryType).toBe('FARM_BORN')
    for (const field of ['newSeller', 'quarantineCertNo', 'vehiclePlate', 'pricingBasis', 'transportFee', 'amountPaid', 'paymentMethod', 'paymentDueDate']) {
      expect(field in save).toBe(false)
    }
    expect('sellerId' in save && save.sellerId !== null).toBe(false)
    expect(save.expectedVersion).toBe(3)
    const post = requests[postIndex]?.body as Record<string, unknown>
    expect(post).toEqual({ expectedVersion: 4, printQr: true })
    expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/attachments'))).toBe(false)
    expect(serverVoucher.status).toBe('POSTED')
    expect(serverVoucher.lines).toEqual(expect.arrayContaining([expect.objectContaining({ cattleId: 7001, cattleCode: 'BC-POSTED-0001', currentHerdStatus: 'ACTIVE' })]))
  })

  it('preserves the calf outcome while posting the edited pen and purpose after reopening', async () => {
    const user = userEvent.setup()
    const { default: ImportNew } = await import('../../../src/features/herd-entry/pages/ImportNew')
    const first = render(<MemoryRouter initialEntries={['/herd-entry/new?id=PN-2026-0041&kind=calf']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)

    await screen.findByDisplayValue('Bê sinh tại trại')
    const calfRow = screen.getByRole('checkbox', { name: 'Chọn VN-ENTRY-1' }).closest('tr')
    expect(calfRow).not.toBeNull()
    const calfSelects = within(calfRow as HTMLElement).getAllByRole('combobox')
    await user.selectOptions(calfSelects[0], 'B1')
    await user.selectOptions(calfSelects[1], 'Nuôi thương phẩm')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT' && request.path.endsWith('/entry-vouchers/41'))).toBe(true))
    const draftPut = requests.find((request) => request.method === 'PUT' && request.path.endsWith('/entry-vouchers/41'))?.body as Record<string, unknown>
    expect((draftPut.lines as Array<Record<string, unknown>>)[0]).toMatchObject({ calfOutcomeId: 501, penId: 12, purposeId: 31 })

    first.unmount()
    requests.length = 0
    render(<MemoryRouter initialEntries={['/herd-entry/new?id=PN-2026-0041&kind=calf']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)
    await screen.findByDisplayValue('Bê sinh tại trại')
    await user.click(screen.getByRole('button', { name: 'Lưu & tạo hồ sơ 1 con' }))
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/entry-vouchers/41/post'))).toBe(true))
    const postPut = requests.find((request) => request.method === 'PUT' && request.path.endsWith('/entry-vouchers/41'))?.body as Record<string, unknown>
    expect((postPut.lines as Array<Record<string, unknown>>)[0]).toMatchObject({ calfOutcomeId: 501, penId: 12, purposeId: 31 })
    expect(requests.find((request) => request.method === 'POST' && request.path.endsWith('/entry-vouchers/41/post'))?.body).toEqual({ expectedVersion: 5, printQr: true })
  })

  it('marks a pending calf dead before registration through the backend command without creating a voucher', async () => {
    const user = userEvent.setup()
    pendingResponse = { ...pendingCalf, draftVoucherId: null }
    vi.spyOn(window, 'prompt').mockReturnValue('Bê chết sau khi sinh')
    const { default: ImportNew } = await import('../../../src/features/herd-entry/pages/ImportNew')
    render(<MemoryRouter initialEntries={['/herd-entry/new?kind=calf']}><Routes><Route path="/herd-entry/new" element={<ImportNew />} /></Routes></MemoryRouter>)

    await screen.findByDisplayValue('Bê sinh tại trại')
    await user.click(screen.getByRole('button', { name: 'Đánh dấu chết trước đăng ký' }))
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && request.path.endsWith('/pending-calves/501/died-before-registration'))).toBe(true))
    expect(requests.find((request) => request.path.endsWith('/pending-calves/501/died-before-registration'))?.body).toEqual({ reason: 'Bê chết sau khi sinh' })
    expect(requests.some((request) => request.path.includes('/entry-vouchers') && request.method !== 'GET')).toBe(false)
    expect(screen.queryByText('VN-ENTRY-1')).not.toBeInTheDocument()
  })
})
