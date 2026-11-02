import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/types'
import { todayIso } from '../../../src/features/herd-exit/data/exportsData'

const apiState = vi.hoisted(() => ({
  exports: [] as HerdExit[],
  hydrated: null as HerdExit | null,
  fetched: [] as string[],
  checks: null as unknown,
  saved: [] as unknown[],
  confirmed: [] as unknown[],
  saveError: null as Error | null,
  saveGate: null as Promise<void> | null,
  checkGate: null as Promise<void> | null,
}))

vi.mock('../../../src/features/herd-exit/api/index', () => ({
  herdExitApi: {
    list: async () => structuredClone(apiState.exports),
    get: async (id: string) => { apiState.fetched.push(id); return structuredClone(apiState.hydrated) },
    checks: async () => { if (apiState.checkGate) await apiState.checkGate; return structuredClone(apiState.checks ?? { voucherId: 61, code: 'PX-2026-0061', version: 1, exitDate: '2026-10-29', cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: false, messages: [] }], occupancy: [] }) },
  },
  getExitDraftState: (rows: HerdExit[], id?: string) => {
    const row = id ? rows.find((item) => item.id === id) : undefined
    return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Bán', row }
  },
  saveHerdExit: async (input: unknown) => { apiState.saved.push(input); if (apiState.saveGate) await apiState.saveGate; if (apiState.saveError) throw apiState.saveError; return input },
  confirmHerdExit: async (id: string, version: number) => { apiState.confirmed.push({ id, version }); return { ...structuredClone(apiState.hydrated), id, status: 'Đã xuất' } },
  listSelectableExitCattle: async () => [{ backendId: 301, code: 'BC-000301', tag: 'VN301', breed: 'Brahman', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', stage: 'Trưởng thành', barn: 'B1', weight: 410, weightNote: 'cân 29/10', estimated: false, unitPrice: 80000 }],
  listExitBuyers: async () => [{ id: 'b1', name: 'Lò mổ Hà Đông', phone: '0243 555 018' }],
  pens: { list: async () => [] },
}))

import ExportNew from '../../../src/features/herd-exit/pages/ExportNew'

const renderPage = (url = '/herd-exit/new') => render(
  <MemoryRouter initialEntries={[url]}>
    <ExportNew />
  </MemoryRouter>,
)

const renderPageWithLocation = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <LocationObserver />
    <Routes><Route path="/herd-exit/new" element={<ExportNew />} /><Route path="/herd-exit" element={<div>exit destination</div>} /></Routes>
  </MemoryRouter>,
)

function LocationObserver() {
  const location = useLocation()
  return <output aria-label="current location">{`${location.pathname}${location.search}`}</output>
}

const existingDraft: HerdExit = {
  id: 'PX-2026-0061', date: '2026-10-29', type: 'Bán', who: 'Lò mổ Hà Đông', count: 1, status: 'Nháp',
  draft: { type: 'Bán', date: '2026-10-29', buyerId: 'b1', pricing: 'con', cows: [{ code: 'BC-000301', weight: 410, unitPrice: 80000, estimated: false }], docs: [] },
}

beforeEach(() => {
  apiState.exports = []
  apiState.hydrated = null
  apiState.fetched = []
  apiState.checks = null
  apiState.saved = []
  apiState.confirmed = []
  apiState.saveError = null
  apiState.saveGate = null
  apiState.checkGate = null
})

describe('Phiếu xuất nháp — chứng từ và giá theo từng con', () => {
  it('formats the injectable local date used by a new voucher', () => {
    expect(todayIso(new Date(2026, 9, 30))).toBe('2026-10-30')
  })

  it('cho phép chọn rồi bỏ một tệp PDF trước khi lưu nháp', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('1. Thông tin phiếu')

    const pdf = new File(['%PDF-1.4'], 'hop-dong.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), pdf)
    expect(screen.getByText('hop-dong.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa hop-dong.pdf' }))
    expect(screen.queryByText('hop-dong.pdf')).not.toBeInTheDocument()
  })

  it('hiển thị bộ chọn cách tính giá và tính tiền theo đầu', async () => {
    renderPage()
    await screen.findByText('1. Thông tin phiếu')

    expect(screen.getByText('Cách tính giá')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo kg' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo con' })).toBeInTheDocument()
  })

  it('khóa loại xuất sau khi nháp đã được lưu lần đầu', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    renderPage('/herd-exit/new?id=PX-2026-0061')
    await screen.findByText('1. Thông tin phiếu')

    expect(apiState.fetched).toEqual(['PX-2026-0061'])
    expect(screen.getByRole('button', { name: 'Chết / mất' })).toBeDisabled()
    expect(screen.getByDisplayValue('Bán')).toHaveAttribute('readonly')
    expect(screen.getByDisplayValue('80.000')).toBeInTheDocument()
  })

  it('enriches hydrated draft rows from selectable cattle metadata', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    renderPage('/herd-exit/new?id=PX-2026-0061')
    await screen.findByText('1. Thông tin phiếu')

    expect(screen.getByText(/24 tháng/)).toBeInTheDocument()
    expect(screen.getAllByText(/Vỗ béo/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Trưởng thành/)).toBeInTheDocument()
  })

  it('enriches a draft line by cattleId when the backend line omits descriptive fields and code', async () => {
    const idOnlyDraft: HerdExit = {
      ...structuredClone(existingDraft),
      draft: { ...structuredClone(existingDraft.draft), cows: [{ code: '', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }] },
    }
    apiState.exports = [{ id: idOnlyDraft.id, date: idOnlyDraft.date, type: idOnlyDraft.type, status: 'Nháp' }]
    apiState.hydrated = idOnlyDraft
    renderPage('/herd-exit/new?id=PX-2026-0061')
    await screen.findByText('1. Thông tin phiếu')

    expect(screen.getByText(/BC-000301/)).toBeInTheDocument()
    expect(screen.getByText(/24 tháng/)).toBeInTheDocument()
    expect(screen.getAllByText(/Vỗ béo/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Trưởng thành/)).toBeInTheDocument()
  })

  it('shows unit prices and derived totals for cull rows as well as sales rows', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: 'Loại thải', status: 'Nháp' }]
    apiState.hydrated = { ...structuredClone(existingDraft), type: 'Loại thải', draft: { ...structuredClone(existingDraft.draft), type: 'Loại thải' } }
    renderPage('/herd-exit/new?id=PX-2026-0061')
    await screen.findByText('1. Thông tin phiếu')

    expect(screen.getByText('Đơn giá/con')).toBeInTheDocument()
    expect(screen.getAllByText('80.000')).toHaveLength(2)
  })

  it('recalculates line and voucher totals when pricing basis changes', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = { ...structuredClone(existingDraft), draft: { ...structuredClone(existingDraft.draft), pricing: 'kg' } }
    const user = userEvent.setup()
    renderPage('/herd-exit/new?id=PX-2026-0061')
    await screen.findByText('1. Thông tin phiếu')

    expect(screen.getAllByText('32.800.000')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Theo con' }))
    expect(screen.getAllByText('80.000')).toHaveLength(2)
  })

  it('keeps the hydrated draft visible when document upload fails', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    apiState.saveError = new Error('Tải chứng từ thất bại')
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    expect((await screen.findAllByText('BC-000301'))[0]).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bán')).toHaveValue('Bán')
    const pdf = new File(['%PDF-1.4'], 'fail.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), pdf)
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))

    expect(await screen.findByText('Tải chứng từ thất bại')).toBeInTheDocument()
    expect(screen.getByText('Phiếu xuất mới')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bán')).toHaveValue('Bán')
    expect(screen.getAllByText('BC-000301')[0]).toBeInTheDocument()
    expect(screen.getByText('fail.pdf')).toBeInTheDocument()
    expect(screen.getByLabelText('current location')).toHaveTextContent('/herd-exit/new?id=PX-2026-0061')
    expect(screen.queryByText('exit destination')).not.toBeInTheDocument()
  })

  it('renders backend check warnings per cattle before enabling acknowledgement', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    apiState.checks = { voucherId: 61, code: existingDraft.id, version: 1, exitDate: '2026-10-29', cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Ngưng giết mổ đến 31/10/2026' }] }], occupancy: [] }
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    await screen.findAllByText('BC-000301')
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    expect(await screen.findByText('Ngưng giết mổ đến 31/10/2026')).toBeInTheDocument()
    const acknowledgement = screen.getByLabelText(/Tôi đã xem các mục trên/)
    expect(acknowledgement).not.toBeDisabled()
    await user.click(acknowledgement)
    expect(screen.getByRole('button', { name: /Xác nhận xuất 1 con/ })).not.toBeDisabled()
  })

  it('ignores a second confirm click while the first save is pending', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    let release!: () => void
    apiState.saveGate = new Promise<void>((resolve) => { release = resolve })
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    await screen.findAllByText('BC-000301')
    const confirm = screen.getByRole('button', { name: /Lưu và kiểm tra/ })
    await user.click(confirm)
    await user.click(confirm)
    expect(apiState.saved).toHaveLength(1)
    release()
    await screen.findByText('Không có cảnh báo')
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: /Xác nhận xuất 1 con/ }))
    expect(await screen.findByText('exit destination')).toBeInTheDocument()
  })

  it('resets checks and acknowledgement when the saved date changes', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    await screen.findAllByText('BC-000301')
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    await screen.findByText('Không có cảnh báo')
    const acknowledgement = screen.getByLabelText(/Tôi đã xem các mục trên/)
    await user.click(acknowledgement)
    expect(screen.getByRole('button', { name: /Xác nhận xuất 1 con/ })).not.toBeDisabled()

    fireEvent.change(screen.getByDisplayValue('2026-10-29'), { target: { value: '2026-10-30' } })

    expect(screen.getByRole('button', { name: /Lưu và kiểm tra/ })).not.toBeDisabled()
    expect(screen.getByLabelText(/Tôi đã xem các mục trên/)).toBeDisabled()
  })

  it('discards a late checks response after the form changes', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    apiState.checks = { voucherId: 61, code: existingDraft.id, version: 1, exitDate: '2026-10-29', cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Cảnh báo cũ' }] }], occupancy: [] }
    let release!: () => void
    apiState.checkGate = new Promise<void>((resolve) => { release = resolve })
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    await screen.findAllByText('BC-000301')
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    fireEvent.change(screen.getByDisplayValue('2026-10-29'), { target: { value: '2026-10-30' } })
    release()

    expect(await screen.findByText('Đang tải kết quả kiểm tra…')).toBeInTheDocument()
    expect(screen.queryByText('Cảnh báo cũ')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Tôi đã xem các mục trên/)).toBeDisabled()
  })

  it('does not expose checks from a save started before the form changed', async () => {
    apiState.exports = [{ id: existingDraft.id, date: existingDraft.date, type: existingDraft.type, status: 'Nháp' }]
    apiState.hydrated = structuredClone(existingDraft)
    apiState.checks = { voucherId: 61, code: existingDraft.id, version: 1, exitDate: '2026-10-29', cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: true, messages: [{ code: 'STALE', text: 'Cảnh báo cũ' }] }], occupancy: [] }
    let release!: () => void
    apiState.saveGate = new Promise<void>((resolve) => { release = resolve })
    const user = userEvent.setup()
    renderPageWithLocation('/herd-exit/new?id=PX-2026-0061')

    await screen.findAllByText('BC-000301')
    await user.click(screen.getByRole('button', { name: /Lưu và kiểm tra/ }))
    fireEvent.change(screen.getByDisplayValue('2026-10-29'), { target: { value: '2026-10-30' } })
    release()

    await screen.findByText('Đang tải kết quả kiểm tra…')
    expect(screen.queryByText('Cảnh báo cũ')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Tôi đã xem các mục trên/)).toBeDisabled()
  })
})
