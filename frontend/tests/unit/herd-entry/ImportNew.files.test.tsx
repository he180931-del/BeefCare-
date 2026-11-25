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

it('new row is staged: cancel adds nothing and does not offer remove', async () => {
 renderPage(); await screen.findByRole('heading',{name:'Phiếu nhập bò mới'});
 await userEvent.click(screen.getByRole('button',{name:'Thêm con'}));
 const dialog=screen.getByRole('dialog',{name:'Thêm con #1'});
 expect(dialog.querySelector('button')?.textContent).not.toBe('Xóa con khỏi phiếu');
 expect(screen.queryByRole('button',{name:'Xóa con khỏi phiếu'})).not.toBeInTheDocument();
 await userEvent.click(screen.getAllByRole('button',{name:'Hủy'}).at(-1)!);
 expect(screen.getByRole('heading',{name:'2. Danh sách bò trong phiếu (0 con)'})).toBeInTheDocument();
 expect(state.saved).toHaveLength(0)
})

it('draft with 3 cows deletes the middle row after confirmation and saves only the other tags',async()=>{
 const row=state.details['PN-2026-0041']; row.draft={...row.draft,cows:[{...cow,tag:'ONE'},{...cow,tag:'TWO'},{...cow,tag:'THREE'}]};
 renderPage('/herd-entry/new?id=PN-2026-0041');await screen.findByRole('heading',{name:'Sửa phiếu nháp PN-2026-0041'});
 await userEvent.click(screen.getByRole('button',{name:'Xóa con #2'}));
 expect(screen.getByText('TWO')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Xóa con'}));
 expect(screen.queryByText('TWO')).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Sửa con #2'}));
 expect(screen.getByLabelText('Số thẻ tai')).toHaveValue('THREE');
 await userEvent.click(screen.getAllByRole('button',{name:'Hủy'}).at(-1)!);
 await userEvent.click(screen.getByRole('button',{name:'Lưu nháp phiếu'}));await waitFor(()=>expect(state.saved).toHaveLength(1));
 expect(state.saved[0].cattleRows?.map(c=>c.tag)).toEqual(['ONE','THREE'])
})

it('saves only accepted freight edits with an optional zero payment', async () => {
  const user = userEvent.setup()
  renderPage('/herd-entry/new?id=PN-2026-0041')
  const openPayment = await screen.findByRole('button', { name: 'Thanh toán' })
  await user.click(openPayment)
  await user.type(screen.getByLabelText('Phí vận chuyển (đ)'), '9000')
  await user.click(screen.getAllByRole('button', { name: 'Hủy' }).at(-1)!)
  await user.click(openPayment)
  const freight = screen.getByLabelText('Phí vận chuyển (đ)')
  expect(freight).toHaveValue('')
  expect(screen.getByLabelText('Số tiền (đ)')).toHaveValue('')
  await user.type(freight, '1500000')
  await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))
  await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
  await waitFor(() => expect(state.saved).toHaveLength(1))
  expect(state.saved[0].record.draft).toMatchObject({ freight: 1500000, paid: 0 })
})

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

const resetToHead = 'Đã đổi cách tính giá sang Theo con. Đơn giá các dòng đã được đặt về 0, vui lòng nhập lại.'
const missingSecondWeight = 'Con #2 chưa có cân. Bạn vẫn lưu nháp được, nhưng cần nhập cân trước khi ghi sổ.'

describe('Phiếu nhập — nháp, chứng từ và Excel', () => {
  it('reopens per-head pricing and keeps weights/bases while resetting prices when the basis changes', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.pricing = 'con'
    row.draft = { ...row.draft, pricing: 'con', cows: [{ ...cow, unitPrice: 8_500_000, weightBasis: 'MEASURED' }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    expect(await screen.findByRole('button', { name: 'Theo con' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Theo kg' }))
    expect(screen.getByText('Đã đổi cách tính giá sang Theo kg. Đơn giá các dòng đã được đặt về 0, vui lòng nhập lại.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ pricing: 'kg', draft: { pricing: 'kg', cows: [{ weight: 280, weightBasis: 'MEASURED', unitPrice: 0 }] } })
  })

  it('allows a kg draft save with a missing weight and displays a non-blocking warning', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'con', cows: [{ ...cow, pricing: 'con', weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo kg' }))
    expect(screen.getByText('Con #1 chưa có cân. Bạn vẫn lưu nháp được, nhưng cần nhập cân trước khi ghi sổ.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ status: 'Nháp', draft: { pricing: 'kg', cows: [{ weight: 0, weightBasis: null, unitPrice: 0 }] } })
  })

  it('saves and reopens a kg draft with missing row 2 weight without persisting warning state', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', receiver: 'An', cows: [cow, { ...cow, tag: 'VN-0042', weight: 0, weightBasis: null }] }
    const page = renderPage('/herd-entry/new?id=PN-2026-0041')
    expect(await screen.findByText(missingSecondWeight)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record).toMatchObject({ status: 'Nháp', draft: { pricing: 'kg', cows: [{ weight: 280 }, { weight: 0, weightBasis: null }] } })
    expect(state.saved[0].record.draft).not.toHaveProperty('priceResetNotice')
    expect(state.saved[0].record.draft).not.toHaveProperty('missingWeightLines')
    state.details[row.id] = { ...row, ...state.saved[0].record, id: row.id, version: 4 }
    page.unmount()
    renderPage('/herd-entry/new?id=PN-2026-0041')
    expect(await screen.findByText(missingSecondWeight)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo kg' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('blocks posting the same kg voucher at missing row 2 without a save request', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', receiver: 'An', cows: [cow, { ...cow, tag: 'VN-0042', weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await screen.findByText(missingSecondWeight)
    await user.click(screen.getByRole('button', { name: /Lưu.*tạo hồ sơ/ }))
    expect(await screen.findByText('Con #2: cân nhập phải lớn hơn 0 kg.')).toBeInTheDocument()
    expect(state.saved).toHaveLength(0)
  })

  it.each([
    [{ weight: 2000, weightBasis: 'MEASURED' as const }, 'Con #1: cân nhập phải từ 1 đến 1.500 kg.'],
  ])('still blocks a hard draft error for %s', async (patch, message) => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', cows: [{ ...cow, ...patch }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(state.saved).toHaveLength(0)
  })

  it('limits the missing-weight warning to five rows and hides it for per-head pricing', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', cows: Array.from({ length: 7 }, (_, index) => ({ ...cow, tag: `VN-${index}`, weight: 0, weightBasis: null })) }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    expect(await screen.findByText('Con #1, #2, #3, #4, #5 và 2 con khác chưa có cân. Bạn vẫn lưu nháp được, nhưng cần nhập cân trước khi ghi sổ.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Theo con' }))
    expect(screen.queryByText(/chưa có cân\. Bạn vẫn lưu nháp được/)).not.toBeInTheDocument()
  })

  it('clears the derived missing-weight warning after the row receives a valid weight and basis', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', cows: [{ ...cow, weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await screen.findByText('Con #1 chưa có cân. Bạn vẫn lưu nháp được, nhưng cần nhập cân trước khi ghi sổ.')
    await user.click(screen.getByRole('button', { name: 'Sửa con #1' }))
    const weight = document.querySelector('#entry-cow-weight') as HTMLInputElement
    await user.clear(weight); await user.type(weight, '250')
    const price = document.querySelector('#entry-cow-unit-price') as HTMLInputElement
    await user.clear(price); await user.type(price, '120000')
    await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
    expect(screen.queryByText(/chưa có cân\. Bạn vẫn lưu nháp được/)).not.toBeInTheDocument()
  })

  it('resets every price on a basis change while preserving weights, bases, estimated flags and payment fields', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', freight: 1500000, paid: 500000, method: 'Tiền mặt', due: '2026-11-30', cows: [
      { ...cow, weight: 250, weightBasis: 'MEASURED', estimated: false, unitPrice: 120000 },
      { ...cow, tag: 'VN-0042', weight: 300, weightBasis: 'ESTIMATED', estimated: true, unitPrice: 90000 },
    ] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo con' }))
    expect(screen.getByText(resetToHead)).toBeInTheDocument()
    expect(screen.queryByText('120.000')).not.toBeInTheDocument()
    expect(screen.queryByText('90.000')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Theo kg' }))
    expect(screen.queryByText(/Đã đổi cách tính giá sang/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record.draft).toMatchObject({ freight: 1500000, paid: 500000, method: 'Tiền mặt', due: '2026-11-30', cows: [
      { weight: 250, weightBasis: 'MEASURED', estimated: false, unitPrice: 0, pricing: 'kg' },
      { weight: 300, weightBasis: 'ESTIMATED', estimated: true, unitPrice: 0, pricing: 'kg' },
    ] })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('does nothing when the already-selected pricing basis is clicked', async () => {
    const user = userEvent.setup()
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo kg' }))
    expect(screen.queryByText(/Đã đổi cách tính giá sang/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record.draft?.cows?.[0].unitPrice).toBe(cow.unitPrice)
  })

  it.each([0, 1])('does not show a reset notice when %s rows have no positive price', async (count) => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'kg', cows: count ? [{ ...cow, unitPrice: 0 }] : [] }
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo con' }))
    expect(screen.queryByText(/Đã đổi cách tính giá sang/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo con' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears the price-reset notice after saving a row with its new price', async () => {
    const user = userEvent.setup()
    renderPage('/herd-entry/new?id=PN-2026-0041')
    await user.click(await screen.findByRole('button', { name: 'Theo con' }))
    expect(screen.getByText(resetToHead)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sửa con #1' }))
    const amount = document.querySelector('#entry-cow-unit-price') as HTMLInputElement
    await user.type(amount, '8500000')
    await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
    expect(screen.queryByText(resetToHead)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await waitFor(() => expect(state.saved).toHaveLength(1))
    expect(state.saved[0].record.draft?.cows?.[0].unitPrice).toBe(8500000)
    expect(state.saved[0].record.draft).not.toHaveProperty('priceResetNotice')
  })

  it('posts a per-head voucher without a weight, using the voucher basis for its row popup and payload', async () => {
    const user = userEvent.setup()
    const row = state.details['PN-2026-0041']
    row.draft = { ...row.draft, pricing: 'con', receiver: 'An', cows: [{ ...cow, pricing: 'kg', unitPrice: 8_500_000, weight: 0, weightBasis: null }] }
    renderPage('/herd-entry/new?id=PN-2026-0041&m=row-1')
    expect(await screen.findByText('Số tiền mua con này')).toBeInTheDocument()
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

  it('keeps edited fields, files and the price-reset notice on 409/Stay until explicit reload', async () => {
    const user = userEvent.setup()
    state.saveError = new BackendError(409, { code: 'MSG-COM-05' })
    renderPage('/herd-entry/new?id=PN-2026-0041')
    const plate = await screen.findByDisplayValue('29C-123.45')
    await user.clear(plate); await user.type(plate, 'BIEN-DANG-SUA')
    const file = new File(['pdf'], 'chua-luu.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), file)
    await user.click(screen.getByRole('button', { name: 'Theo con' }))
    expect(screen.getByText(resetToHead)).toBeInTheDocument()
    state.details['PN-2026-0041'] = { ...state.details['PN-2026-0041'], version: 9, draft: { ...state.details['PN-2026-0041'].draft, plate: 'BIEN-MOI-NHAT' } }
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(screen.getByText(resetToHead)).toBeInTheDocument()
    expect(state.saved[0]).toMatchObject({ expectedVersion: 3, record: { backendId: 41 } })
    expect(state.saved[0].documents).toEqual([file])
    expect(state.getCalls).toHaveLength(1)
    expect(state.saved).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('BIEN-DANG-SUA')).toBeInTheDocument()
    expect(screen.getByText('chua-luu.pdf')).toBeInTheDocument()
    expect(screen.getByText(resetToHead)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tải bản mới nhất' })).not.toBeInTheDocument()
    state.saveError = new BackendError(409, { code: 'MSG-COM-05' })
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await user.click(await screen.findByRole('button', { name: 'Tải bản mới nhất' }))
    expect(await screen.findByDisplayValue('BIEN-MOI-NHAT')).toBeInTheDocument()
    expect(screen.queryByText('chua-luu.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText(resetToHead)).not.toBeInTheDocument()
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
