import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntryCow, HerdEntry } from '../../../src/features/herd-entry/types'
import type { Pen } from '../../../src/features/pen-management/types'
import { BackendError } from '../../../src/shared/api/backendClient'

const state = vi.hoisted(() => ({
  entries: [] as HerdEntry[],
  details: {} as Record<string, HerdEntry>,
  getCalls: [] as string[],
  saved: [] as Array<{ id?: string; expectedVersion?: number; record: Partial<HerdEntry>; cattleRows?: EntryCow[]; documents?: File[] }>,
  saveError: null as Error | null,
  savedVersion: 3,
  previewCalls: [] as Array<{ id: string; file: File }>,
  commitCalls: [] as Array<{ id: string; file: File }>,
  removed: [] as Array<{ id: string; attachmentId: number }>,
  generatedId: 'PN-2026-0099',
}))

const pens: Pen[] = [
  { code: 'A1', name: 'A1 – Bò cái', count: 10, capacity: 30, status: 'ACTIVE', cows: [] },
  { code: 'A2', name: 'A2 – Bò cái', count: 12, capacity: 30, status: 'ACTIVE', cows: [] },
  { code: 'B1', name: 'B1 – Vỗ béo', count: 20, capacity: 50, status: 'ACTIVE', cows: [] },
  { code: 'B2', name: 'B2 – Đực giống', count: 3, capacity: 10, status: 'ACTIVE', cows: [] },
  { code: 'C1', name: 'C1 – Cách ly', count: 0, capacity: 10, status: 'ACTIVE', cows: [] },
  { code: 'A3', name: 'A3 – Bê theo mẹ', count: 5, capacity: 20, status: 'ACTIVE', cows: [] },
]

const sellers = [
  { id: '7', name: 'Trang trại Mộc Châu', phone: '0901000000' },
  { id: '8', name: 'Hộ ông Lê Văn C', phone: '0902000000' },
]

vi.mock('../../../src/features/herd-entry/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/features/herd-entry/api/index')>()
  const { entryToday } = await import('../../../src/features/herd-entry/validation/entryValidation')
  return {
    ...actual,
    entryExcelBackendEnabled: true,
    // Same blank voucher as the backend adapter.
    newEntryDefaults: ({ receiver }: { receiver: string }) => ({ recordId: 'Tự động khi lưu', date: entryToday(), quarantine: '', receiver, note: '', cows: [], freight: 0, paid: 0, method: '', due: '' }),
    herdEntryApi: {
      ...actual.herdEntryApi,
      list: async () => structuredClone(state.entries),
      get: async (id: string) => {
        state.getCalls.push(id)
        const row = state.details[id]
        if (!row) throw new Error(`Không tìm thấy phiếu nhập ${id}`)
        return structuredClone(row)
      },
    },
    pens: { ...actual.pens, list: async () => structuredClone(pens) },
    listEntryPens: async () => structuredClone(pens),
    listPendingEntryCalves: async () => [],
    listEntrySellers: async () => structuredClone(sellers),
    saveHerdEntry: async (input: (typeof state.saved)[number]) => {
      state.saved.push(input)
      if (state.saveError) throw state.saveError
      return {
        ...input.record,
        id: input.id && state.details[input.id] ? input.id : state.generatedId,
        status: input.record.status ?? 'Nháp',
        backendId: 41,
        version: ++state.savedVersion,
        draft: input.record.draft,
      } as HerdEntry
    },
    previewEntryExcel: async (id: string, file: File) => {
      state.previewCalls.push({ id, file })
      return { rows: [{ row: 2, earTag: 'VN-9001', breed: 'Lai Sind', sex: 'FEMALE', weight: 280, pen: 'A1', result: 'VALID' }] }
    },
    commitEntryExcel: async (id: string, file: File) => {
      state.commitCalls.push({ id, file })
      return { rows: [] }
    },
    downloadEntryImportTemplate: async () => new Blob(['xlsx']),
    downloadEntryAttachment: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    removeEntryAttachment: async (id: string, attachmentId: number) => {
      state.removed.push({ id, attachmentId })
    },
  }
})

import ImportNew from '../../../src/features/herd-entry/pages/ImportNew'

const cow: EntryCow = {
  tag: 'VN-0041', name: 'Bò 41', breed: 'Lai Sind', sex: 'Cái', dob: '2025-04', dobAccuracy: 'Ước tính',
  stage: 'Bò tơ', purpose: 'Bò sinh sản', weight: 280, estimated: false, barn: 'A1', unitPrice: 85_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

function renderPage(url = '/herd-entry/new') {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[url]}>
      <ImportNew />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.entries = [{ id: 'PN-2026-0041', status: 'Nháp', type: 'Mua ngoài', date: '2026-10-18', count: 1 }]
  state.details = {
    'PN-2026-0041': {
      id: 'PN-2026-0041', backendId: 41, version: 3, status: 'Nháp', type: 'Mua ngoài', date: '2026-10-18', source: sellers[0].name, count: 1,
      draft: { type: 'Mua ngoài', date: '2026-10-18', sourceId: '7', quarantine: '', plate: '29C-123.45', note: 'Nháp từ backend', cows: [cow] },
      detail: { docs: [{ id: 71, ext: 'PDF', name: 'kiem-dich-41.pdf', size: 12 }] },
    },
  }
  state.getCalls = []
  state.saved = []
  state.saveError = null
  state.savedVersion = 3
  state.previewCalls = []
  state.commitCalls = []
  state.removed = []
  state.generatedId = 'PN-2026-0099'
})

describe('Phiếu nhập — nháp, chứng từ và Excel', () => {
  it('reopens per-head pricing and keeps weights, bases and unit prices when switching the voucher basis', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.pricing = 'con'
    row.draft = { ...row.draft, pricing: 'con', cows: [{ ...cow, unitPrice: 8_500_000, weightBasis: 'MEASURED' }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    expect(await screen.findByRole('button', { name: 'Theo con' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Theo kg' }))
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ pricing: 'kg', draft: { pricing: 'kg', cows: [{ weight: 280, weightBasis: 'MEASURED', unitPrice: 8_500_000 }] } })
  })

  it('blocks a kg draft save after switching from per head while a row has no weight', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'con', cows: [{ ...cow, pricing: 'con', weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo kg' }))
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(await screen.findByText(/Con #1:.*cân nhập/)).toBeInTheDocument()
    expect(state.saved).toHaveLength(0)
  })

  it('posts a per-head voucher without a weight, using the voucher basis for its row popup and payload', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'con', receiver: 'An', cows: [{ ...cow, pricing: 'kg', unitPrice: 8_500_000, weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041&m=row-1')
    expect(await screen.findByText('Cách tính giá: Theo con (áp cho cả phiếu)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
    await user.click(screen.getByRole('button', { name: /Lưu.*tạo hồ sơ/ }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ status: 'Đã nhập', pricing: 'con' })
    expect(state.saved[0].cattleRows).toMatchObject([{ weight: 0, weightBasis: null, unitPrice: 8_500_000 }])
  })

  it('keeps per-head pricing through Excel preparation and applies it to imported rows', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'con', cows: [{ ...cow, pricing: 'con' }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Nhập từ Excel' }))
    await user.upload(screen.getByLabelText('Chọn file Excel nhập đàn'), new File(['xlsx'], 'theo-con.xlsx'))
    await waitFor(() => expect(state.previewCalls).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ pricing: 'con', draft: { pricing: 'con' } })
    row.version = 5
    row.draft = { ...row.draft, cows: [{ ...cow, pricing: undefined, weight: 300, weightBasis: 'ESTIMATED', estimated: true, unitPrice: 8_500_000 }] }
    await user.click(screen.getByRole('button', { name: 'Thêm 1 con vào phiếu' }))
    await waitFor(() => expect(screen.queryByLabelText('Chọn file Excel nhập đàn')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(2))
    expect(state.saved[1].record).toMatchObject({ pricing: 'con', draft: { pricing: 'con' } })
    expect(state.saved[1].cattleRows).toMatchObject([{ pricing: 'con', weight: 300, weightBasis: 'ESTIMATED', unitPrice: 8_500_000 }])
  })

  it('keeps edited fields and files on 409/Stay, and replaces them only after explicit reload', async () => {
    const user = userEvent.setup()
    state.saveError = new BackendError(409, { code: 'MSG-COM-05' })
    renderPage('/herd-entry/new?id=PN-2026-0041')
    const plate = await screen.findByDisplayValue('29C-123.45')
    await user.clear(plate); await user.type(plate, 'BIEN-DANG-SUA')
    const file = new File(['pdf'], 'chua-luu.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), file)
    state.details['PN-2026-0041'] = { ...state.details['PN-2026-0041'], version: 9, draft: { ...state.details['PN-2026-0041'].draft, plate: 'BIEN-MOI-NHAT' } }
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(state.saved[0]).toMatchObject({ expectedVersion: 3, record: { backendId: 41 } })
    expect(state.saved[0].documents).toEqual([file])
    expect(state.getCalls).toHaveLength(1)
    expect(state.saved).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('BIEN-DANG-SUA')).toBeInTheDocument()
    expect(screen.getByText('chua-luu.pdf')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tải bản mới nhất' })).not.toBeInTheDocument()
    state.saveError = new BackendError(409, { code: 'MSG-COM-05' })
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await user.click(await screen.findByRole('button', { name: 'Tải bản mới nhất' }))
    expect(await screen.findByDisplayValue('BIEN-MOI-NHAT')).toBeInTheDocument()
    expect(screen.queryByText('chua-luu.pdf')).not.toBeInTheDocument()
    expect(state.getCalls).toHaveLength(2)
    expect(state.saved).toHaveLength(2)
  })

  it('uses the returned version for the second draft save during Excel preview', async () => {
    const user = userEvent.setup()
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Nhập từ Excel' }))
    const input = screen.getByLabelText('Chọn file Excel nhập đàn')
    await user.upload(input, new File(['first'], 'one.xlsx'))
    await waitFor(() => expect(state.previewCalls).toHaveLength(1))
    await user.upload(input, new File(['second'], 'two.xlsx'))
    await waitFor(() => expect(state.previewCalls).toHaveLength(2))
    expect(state.saved.map((saved) => saved.expectedVersion)).toEqual([3, 4])
    expect(state.saved.map((saved) => saved.record.backendId)).toEqual([41, 41])
  })

  it('backend mode starts a blank voucher instead of seeding demo cattle and payment values', async () => {
    state.entries = []
    state.details = {}
    renderPage()

    await screen.findByText('1. Thông tin phiếu')
    expect(screen.queryByDisplayValue('VN-0503')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Anh A')).not.toBeInTheDocument()
    expect(screen.queryByText('1.500.000')).not.toBeInTheDocument()
  })

  it('mở nháp bằng API chi tiết và phục hồi dòng bò cùng chứng từ đã lưu', async () => {
    renderPage('/herd-entry/new?id=PN-2026-0041')

    expect(await screen.findByDisplayValue('29C-123.45')).toBeInTheDocument()
    expect(screen.getByText('VN-0041')).toBeInTheDocument()
    expect(screen.getByText('kiem-dich-41.pdf')).toBeInTheDocument()
    expect(state.getCalls).toEqual(['PN-2026-0041'])
  })

  it('xóa chứng từ đã lưu qua API rồi bỏ nó khỏi danh sách', async () => {
    const user = userEvent.setup()
    renderPage('/herd-entry/new?id=PN-2026-0041')

    await user.click(await screen.findByRole('button', { name: 'Xóa kiem-dich-41.pdf' }))

    await waitFor(() => expect(state.removed).toEqual([{ id: 'PN-2026-0041', attachmentId: 71 }]))
    expect(screen.queryByText('kiem-dich-41.pdf')).not.toBeInTheDocument()
  })

  it('chỉ giữ một bản của cùng file và truyền file mới vào lệnh lưu nháp', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('1. Thông tin phiếu')
    const file = new File(['%PDF-1.4'], 'hoa-don.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('Chọn chứng từ đính kèm')

    await user.upload(input, file)
    await user.upload(input, file)
    expect(screen.getAllByText('hoa-don.pdf')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].documents).toEqual([file])
  })

  it('từ chối PNG và file lớn hơn 10 MiB trước khi lưu', async () => {
    renderPage()
    await screen.findByText('1. Thông tin phiếu')
    const input = screen.getByLabelText('Chọn chứng từ đính kèm')

    fireEvent.change(input, { target: { files: [new File(['png'], 'anh.png', { type: 'image/png' })] } })
    expect(await screen.findByText(/anh\.png.*chỉ nhận PDF\/JPG/i)).toBeInTheDocument()
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'lon.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByText(/lon\.pdf.*tối đa 10MB/i)).toBeInTheDocument()
    expect(screen.queryByText('lon.pdf', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('lưu DRAFT trước và dùng mã backend vừa cấp để preview Excel', async () => {
    const user = userEvent.setup()
    state.entries = [{ id: 'PN-2026-0013', status: 'Đã nhập', type: 'Mua ngoài', date: '2026-10-17', count: 1 }]
    state.details = {}
    renderPage()
    await screen.findByText('1. Thông tin phiếu')

    await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' }))
    const file = new File(['xlsx'], 'dan-bo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await user.upload(screen.getByLabelText('Chọn file Excel nhập đàn'), file)

    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record.status).toBe('Nháp')
    expect(state.previewCalls).toEqual([{ id: 'PN-2026-0099', file }])
  })
})
