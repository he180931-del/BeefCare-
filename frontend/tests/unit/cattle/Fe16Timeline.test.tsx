import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { mapTimeline, timelineMeta, TIMELINE_FILTERS } from '../../../src/api/cattleTimeline'
import TimelineTab, { timelineGroups } from '../../../src/features/cattle/components/TimelineTab'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { initialCows } from '../../../src/data/cowsData'
import type { CowSeed } from '../../../src/data/cowsData'
import { reproductionApi, resetReproductionDemo } from '../../../src/features/reproduction/api/reproductionApi'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'

const ev = (over: Record<string, unknown>, i = 0) => mapTimeline({ recorder: 'Quản lý A', ...over }, i)

const events = [
  ev({ category: 'GROWTH', type: 'GROWTH_ASSESSMENT', sourceId: 1, occurredAt: '2026-10-01T03:00:00Z', recordedAt: '2026-10-05T03:00:00Z', status: 'CORRECTED', corrected: true, values: { weightKg: 324, basis: 'MEASURED', method: 'SCALE', reason: 'Gõ nhầm' } }, 0),
  ev({ category: 'VACCINATION', type: 'VACCINATION_RECORD', sourceId: 2, occurredAt: '2026-10-03T03:00:00Z', recordedAt: '2026-10-03T03:00:00Z', status: 'VOIDED', values: { vaccine: 'LMLM', source: 'ON_FARM' } }, 1),
  ev({ category: 'GROWTH', type: 'REVISION', sourceId: 9, occurredAt: '2026-10-01T03:00:00Z', recordedAt: '2026-10-06T03:00:00Z', status: 'CORRECT', values: { original: { weightKg: 342, basis: 'MEASURED' } }, correction: { reason: 'Gõ nhầm', sourceType: 'GROWTH_ASSESSMENT', sourceId: 1 } }, 2),
  ev({ category: 'PEN', type: 'PEN_ASSIGNMENT', sourceId: 3, occurredAt: '2026-09-20T00:00:00+07:00', recordedAt: '2026-09-20T03:00:00Z', status: 'VALID', values: { penCode: 'A1', reason: 'Nhập đàn' } }, 3),
  ev({ category: 'ENTRY_EXIT', type: 'HERD_ENTRY', sourceId: 4, occurredAt: '2026-09-20T00:00:00+07:00', recordedAt: '2026-09-20T02:00:00Z', status: 'VALID', values: { source: 'EXTERNAL', weight: 300, basis: 'ESTIMATED', voucherCode: 'PN-2026-0011' } }, 4),
]

const cow = (list = events): CowSeed => ({ ...initialCows[0], status: 'ACTIVE', events: list })
const session = (role: Session['role']): Session => ({ role, fullName: 'X', email: 'x@x', farmId: 1, farmName: 'A', logout: async () => undefined })
const renderTab = (role: Session['role'], list = events) => render(
  <SessionContext.Provider value={session(role)}><MemoryRouter><TimelineTab cow={cow(list)} /></MemoryRouter></SessionContext.Provider>,
)

describe('FE-16 timeline mapping', () => {
  it('maps titles, basis and correction markers in Vietnamese (R-16-03, SCR-50 #4–6)', () => {
    expect(events[0]).toMatchObject({ title: 'Cân 324 kg', basis: 'Đo', status: 'CORRECTED', marker: 'Đã sửa', reason: 'Gõ nhầm', tab: 'growth', correctable: true })
    expect(events[1]).toMatchObject({ title: 'Tiêm LMLM', basis: 'Tại trại', status: 'VOIDED', marker: 'Đã hủy', correctable: false })
    expect(events[2]).toMatchObject({ status: 'REVISION', title: 'Giá trị trước khi sửa: Cân 342 kg', reason: 'Gõ nhầm' })
    expect(events[4]).toMatchObject({ title: 'Nhập đàn – mua ngoài', basis: 'Ước tính', voucher: { kind: 'entry', code: 'PN-2026-0011' } })
    expect(TIMELINE_FILTERS.map(([, label]) => label)).toContain('Nhập & xuất')
  })

  it('writes "Xảy ra … · ghi … · bởi …" (SCR-50 #8)', () => {
    expect(timelineMeta('2026-10-01', '2026-10-05', 'Quản lý A')).toBe('Xảy ra 01/10/2026 · ghi 05/10/2026 · bởi Quản lý A')
  })

  it('TC-16-02 / 04: newest occurrence first; voided, excluded and originals hidden until "Hiện chỉnh sửa"', () => {
    const hidden = timelineGroups(events, 'all', false).flatMap((g) => g.items.map((e) => e.title))
    expect(hidden).toEqual(['Cân 324 kg', 'Vào chuồng A1', 'Nhập đàn – mua ngoài'])
    expect(hidden).not.toContain('Tiêm LMLM')
    const all = timelineGroups(events, 'all', true).flatMap((g) => g.items.map((e) => e.title))
    expect(all.indexOf('Tiêm LMLM')).toBeLessThan(all.indexOf('Cân 324 kg'))
    expect(all).toContain('Giá trị trước khi sửa: Cân 342 kg')
    expect(timelineGroups(events, 'all', true).map((g) => g.label)).toEqual(['THÁNG 10 2026', 'THÁNG 9 2026'])
  })
})

describe('FE-16 timeline tab', () => {
  it('TC-16-09: the Manager sees Sửa / Hủy on care records only with "Hiện chỉnh sửa" on', async () => {
    const user = userEvent.setup()
    renderTab('MANAGER')
    expect(screen.queryByRole('button', { name: 'Sửa / Hủy' })).not.toBeInTheDocument()
    expect(screen.queryByText('Tiêm LMLM')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Hiện chỉnh sửa'))
    expect(screen.getByText('Tiêm LMLM')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sửa / Hủy' })).toHaveLength(1)
  })

  it('TC-16-10: the Technician never sees Sửa / Hủy', async () => {
    const user = userEvent.setup()
    renderTab('TECHNICIAN')
    await user.click(screen.getByLabelText('Hiện chỉnh sửa'))
    expect(screen.queryByRole('button', { name: 'Sửa / Hủy' })).not.toBeInTheDocument()
  })

  it('TC-16-06: the Nhập & xuất chip shows only entry / exit events; empty state', async () => {
    const user = userEvent.setup()
    renderTab('OWNER')
    await user.click(screen.getByRole('button', { name: 'Nhập & xuất' }))
    expect(screen.getByText('Nhập đàn – mua ngoài')).toBeInTheDocument()
    expect(screen.queryByText('Vào chuồng A1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sức khỏe' }))
    expect(screen.getByText('Chưa có sự kiện')).toBeInTheDocument()
  })

  it('TC-16-07 / 08: an entry event without a voucher (Technician) cannot be opened — MSG-FE16-01', async () => {
    const user = userEvent.setup()
    const techEntry = ev({ category: 'ENTRY_EXIT', type: 'HERD_ENTRY', sourceId: null, occurredAt: '2026-09-20T00:00:00+07:00', status: 'VALID', values: { source: 'EXTERNAL', weight: 300 } })
    renderTab('TECHNICIAN', [techEntry])
    const row = screen.getByText('Nhập đàn – mua ngoài').closest('div')!.parentElement!.parentElement!
    await user.click(within(row).getByRole('button', { name: 'Xem chi tiết' }))
    expect(screen.getByText('Bạn không có quyền xem chi tiết này.')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('FE-16 opens the source correction popup (R-16-07)', () => {
  const growth = (canCorrect: boolean) => ev({ category: 'GROWTH', type: 'GROWTH_ASSESSMENT', sourceId: 77, occurredAt: '2026-10-01T03:00:00Z', status: 'VALID', values: { weightKg: 320 }, canOpen: true, canCorrect })

  it('uses the backend canCorrect and passes the record id to the source tab', async () => {
    const user = userEvent.setup()
    // Even an Owner session follows the backend: canCorrect=true shows the action, canCorrect=false hides it.
    render(<SessionContext.Provider value={session('OWNER')}><MemoryRouter initialEntries={['/cattle/BC-1']}>
      <TimelineTab cow={cow([growth(true), { ...growth(false), id: 'other', title: 'Cân 321 kg' }])} />
    </MemoryRouter></SessionContext.Provider>)
    await user.click(screen.getByLabelText('Hiện chỉnh sửa'))
    expect(screen.getAllByRole('button', { name: 'Sửa / Hủy' })).toHaveLength(1)
    expect(growth(true)).toMatchObject({ sourceId: 77, correctable: true, accessFromBackend: true, tab: 'growth' })
  })

  it('backend canOpen=false answers MSG-FE16-01', async () => {
    const user = userEvent.setup()
    const denied = ev({ category: 'ENTRY_EXIT', type: 'HERD_EXIT', sourceId: null, occurredAt: '2026-10-01T03:00:00Z', status: 'CONFIRMED', values: { exitType: 'SALE' }, canOpen: false, canCorrect: false })
    renderTab('TECHNICIAN', [denied])
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết' }))
    expect(screen.getByText('Bạn không có quyền xem chi tiết này.')).toBeInTheDocument()
  })

  it('the reproduction tab opens its revise dialog from ?m=correct&r=<id> for a Manager only', async () => {
    await resetReproductionDemo()
    const profile = await reproductionApi.getProfile('BC-000142')
    const target = profile.events.find((e) => e.type !== 'CALVING')!
    const at = (role: 'MANAGER' | 'TECHNICIAN') => render(
      <MemoryRouter initialEntries={[`/cattle/BC-000142?tab=repro&m=correct&r=${target.id}`]}><ReproductionProfileTab cattleCode="BC-000142" role={role} /></MemoryRouter>,
    )
    const manager = at('MANAGER')
    expect(await screen.findByText('Sửa bản ghi')).toBeInTheDocument()
    manager.unmount()
    at('TECHNICIAN')
    expect(await screen.findByText('Kỹ thuật viên chỉ xem hồ sơ và dòng thời gian sinh sản.')).toBeInTheDocument()
    expect(screen.queryByText('Sửa bản ghi')).not.toBeInTheDocument()
  })
})

