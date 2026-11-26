import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Session } from '../../../src/app/session/sessionTypes'
import { mapCattleReminders } from '../../../src/features/cattle/api/cattleReminders'
import { mapBackendCattle } from '../../../src/features/cattle/api/cattleBackendApi'
import { cowDesc } from '../../../src/features/cattle/components/CowHeader'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const session = (role: Session['role'], extra: Partial<Session> = {}): Session => ({
  role, fullName: 'Người thử', email: 'thu@example.test', farmId: 9, farmName: 'Trại 9', logout: async () => undefined, ...extra,
})

const baseProfile = {
  id: 42, displayCode: 'BC-042', earTagNumber: '', sex: 'FEMALE', birthDate: '2025-08-01', birthDateAccuracy: 'EXACT', breedName: 'Lai Sind',
  purposeId: 3, purposeName: 'Vỗ béo', purposeType: 'FATTENING', lifeStage: 'WEANED_CALF', herdStatus: 'ACTIVE', herdGroup: 'CALVES', version: 5,
  healthState: 'HEALTHY', withdrawalActive: false, reproductiveStatus: 'NOT_APPLICABLE', canUpdate: true, canChangePurpose: true, exitPending: false,
  entry: { source: 'EXTERNAL', entryDate: '2026-01-10' },
}
const reminder = (id: number, cattleId: number, ruleType: string, dueTime: string, extra: Record<string, unknown> = {}) => ({
  id, ruleType, cattleId, dueTime, lifecycleStatus: 'ACTIVE', urgency: 'UPCOMING', sourceSummary: null, ...extra,
})

describe('FE-05 related reminders (SCR-19 #22)', () => {
  it('keeps only open reminders of the cattle, earliest due first', () => {
    const rows = mapCattleReminders([
      reminder(1, 42, 'REM-01', '2026-12-10T01:00:00Z'),
      reminder(2, 7, 'REM-01', '2026-11-01T01:00:00Z'),
      reminder(3, 42, 'REM-08', '2026-11-30T18:00:00Z', { sourceId: 'STAGE:YOUNG_STOCK' }),
      reminder(4, 42, 'REM-06', '2026-11-20T01:00:00Z', { lifecycleStatus: 'RESOLVED' }),
    ], 42)
    expect(rows.map((r) => r.id)).toEqual(['3', '1'])
    // 30/11 18:00 UTC is 01/12 in farm time (UTC+7).
    expect(rows[0]).toMatchObject({ stage: 'YOUNG_STOCK', dueDate: '2026-12-01', due: { label: '01/12/2026' }, title: 'Gợi ý chuyển chuồng hoặc giai đoạn' })
  })
})

describe('FE-05 profile summary line (SCR-19 #3, D78)', () => {
  const desc = (patch: Record<string, unknown>) =>
    cowDesc(mapBackendCattle({ id: 42, displayCode: 'BC-042', herdStatus: 'ACTIVE', breedName: 'Lai Sind', sex: 'FEMALE', birthDate: '2024-01-01', penCode: 'B1', ...patch }, null, [], [], {}, '2026-11-26'))

  it('ends with the latest weight and its date', () => {
    expect(desc({ latestWeightKg: 342, latestWeightDate: '2026-10-18' })).toContain('342 kg (18/10/2026)')
  })

  it('marks an estimated weight and omits the weight when there is none', () => {
    expect(desc({ latestWeightKg: 318, weightBasis: 'ESTIMATED' })).toContain('318 kg*')
    expect(desc({})).not.toContain('kg')
  })
})

describe('FE-05 profile spec gaps (backend mode)', () => {
  let profile: Record<string, unknown>
  let reminders: unknown
  let profileWrites: Array<Record<string, unknown>>

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    sessionStorage.setItem('beefcare.currentFarmId', '9')
    profile = { ...baseProfile }
    profileWrites = []
    reminders = [
      ...[1, 2, 3, 4, 5].map((n) => reminder(n, 42, 'REM-01', `2026-12-0${n}T01:00:00Z`)),
      reminder(6, 42, 'REM-08', '2026-06-15T01:00:00Z', { sourceId: 'STAGE:YOUNG_STOCK' }),
      reminder(7, 99, 'REM-03', '2026-11-01T01:00:00Z'),
    ]
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      const path = url.pathname
      if (path === '/api/csrf') return response({ token: 'csrf' })
      if (path.endsWith('/cattle/resolve')) return response({ cattleId: 42, cattle: profile })
      if (path.endsWith('/cattle/42/profile') && init?.method === 'PUT') {
        profileWrites.push(JSON.parse(String(init.body)))
        profile = { ...profile, lifeStage: 'YOUNG_STOCK', version: 6 }
        reminders = []
        return response({ ...profile })
      }
      if (path.endsWith('/cattle/42')) return response(profile)
      if (path.endsWith('/pen-history')) return response({ history: [] })
      if (path.endsWith('/reminders')) return reminders instanceof Error ? response({ code: 'X', message: 'lỗi' }, 500) : response(reminders)
      if (path.endsWith('/pens') || path.endsWith('/qr-tags') || path.endsWith('/timeline') || path.endsWith('/production-purposes')) return response([])
      throw new Error(`Unexpected request ${path}`)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    sessionStorage.removeItem('beefcare.currentFarmId')
  })

  const Where = () => <p data-testid="where">{useLocation().search}</p>
  async function renderProfile(role: Session['role'], path = '/cattle/BC-042', wrap?: (node: ReactNode) => ReactNode) {
    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    const { SessionContext } = await import('../../../src/app/session/sessionContext')
    const tree = (
      <SessionContext.Provider value={session(role)}>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="/cattle/:code" element={<><CowProfile /><Where /></>} /></Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    )
    render(<>{wrap ? wrap(tree) : tree}</>)
    await screen.findByText('Thông tin cá thể')
  }

  it('shows at most five reminders and reviews the REM-08 suggestion in the stage tab, then reloads', async () => {
    const user = userEvent.setup()
    await renderProfile('MANAGER')
    expect(await screen.findByText(/Gợi ý: chuyển sang Bò tơ từ 15\/06\/2026/)).toBeInTheDocument()
    // D78: bò đang nuôi bình thường không hiện huy hiệu trạng thái đàn ở tiêu đề.
    expect(screen.queryByText('Đang nuôi')).not.toBeInTheDocument()
    expect(screen.getAllByText(/Gắn tai sau/).length).toBeGreaterThan(0)
    const panel = screen.getByText('Nhắc việc liên quan').closest('div')!.parentElement!
    expect(within(panel).getAllByRole('row')).toHaveLength(1 + 5)
    expect(within(panel).getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute('href', '/nhac-viec')

    await user.click(screen.getByRole('button', { name: 'Xem xét' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Điền sẵn theo gợi ý đổi giai đoạn/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Mục đích nuôi chỉ Chủ trại/)).not.toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Đến ngưỡng tuổi theo tham số trại')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(profileWrites).toHaveLength(1))
    expect(profileWrites[0]).toMatchObject({ lifeStage: 'YOUNG_STOCK', effectiveDate: '2026-06-15', reason: 'Đến ngưỡng tuổi theo tham số trại', expectedVersion: 5 })
    await waitFor(() => expect(screen.queryByText(/Gợi ý: chuyển sang/)).not.toBeInTheDocument())
    expect(screen.getByText('Không có nhắc việc.')).toBeInTheDocument()
  })

  it('gives the Technician no review button and keeps the profile when reminders fail', async () => {
    reminders = new Error('down')
    await renderProfile('TECHNICIAN')
    expect(await screen.findByText('Không tải được nhắc việc.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem xét' })).not.toBeInTheDocument()
    // D79: khối Định danh gộp vào Thông tin cá thể (mã, số tai đã có ở tiêu đề).
    expect(screen.getByText('Thông tin cá thể')).toBeInTheDocument()
  })

  it('hides the Reproduction tab of a male and sends ?tab=repro back to the overview', async () => {
    profile = { ...profile, sex: 'MALE' }
    await renderProfile('OWNER', '/cattle/BC-042?tab=repro')
    expect(screen.queryByRole('button', { name: 'Sinh sản' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(''))
    expect(screen.getByText('Tóm tắt chăm sóc')).toBeInTheDocument()
  })

  it('keeps 6 tabs and opens the overview section for an old ?tab=qr link (D79)', async () => {
    await renderProfile('OWNER', '/cattle/BC-042?tab=qr')
    // Thanh tab: không còn tab Lịch sử chuồng / Thẻ QR; nút cùng tên giờ là tiêu đề khối gập.
    expect(screen.getAllByRole('button', { name: 'Thẻ QR' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Thẻ QR' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Lịch sử chuồng' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Tóm tắt chăm sóc')).toBeInTheDocument()
    for (const name of ['Tổng quan', 'Dòng thời gian', 'Tăng trưởng & BCS', 'Tiêm phòng', 'Sức khỏe', 'Sinh sản']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it.each([
    [{ herdStatus: 'EXITED', exitType: 'SALE', exitDate: '2026-10-20', canUpdate: false }, 'BC-042 đã rời đàn ngày 20/10/2026 (Bán). Hồ sơ chỉ xem.', 'Đã xuất · Bán · 20/10/2026'],
    [{ herdStatus: 'VOIDED', canUpdate: false }, 'Bản ghi nhập của BC-042 đã bị hủy. Hồ sơ chỉ xem và không tính vào đàn.', 'Nhập nhầm – đã hủy'],
    [{ exitPending: true }, 'BC-042 đang trên phiếu xuất chờ xử lý. Không ghi sự kiện mới, chuyển chuồng hay sửa hồ sơ.', 'Chờ xuất'],
  ])('shows the read-only banner and badge without write actions (%#)', async (patch, banner, badge) => {
    profile = { ...profile, ...patch }
    await renderProfile('OWNER')
    expect(screen.getByText(banner)).toBeInTheDocument()
    expect(screen.getByText(badge)).toBeInTheDocument()
    expect(screen.queryByText('Đang nuôi')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cập nhật hồ sơ' })).not.toBeInTheDocument()
  })

  it('shows MSG-FE05-02 under the ear tag field', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://backend.test').pathname
      if (path === '/api/csrf') return response({ token: 'csrf' })
      if (path.endsWith('/cattle/42/profile') && init?.method === 'PUT') return response({ code: 'MSG-FE05-02', message: 'dup', params: {} }, 409)
      if (path.endsWith('/cattle/resolve')) return response({ cattleId: 42, cattle: profile })
      if (path.endsWith('/cattle/42')) return response(profile)
      if (path.endsWith('/pen-history')) return response({ history: [] })
      return response([])
    })
    await renderProfile('OWNER', '/cattle/BC-042?m=photo')
    const dialog = await screen.findByRole('dialog')
    const field = within(dialog).getByText('Số thẻ tai').parentElement!
    const tagInput = field.querySelector('input')!
    await user.type(tagInput, 'T-01')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    const message = await within(dialog).findByText('Số tai T-01 đã được dùng cho một bò đang nuôi của trại.')
    expect(field).toContainElement(message)
  })
})

describe('FE-05 other-farm scan (MSG-FE05-06)', () => {
  afterEach(() => vi.restoreAllMocks())
  it('names the farm from the session and never shows its id', async () => {
    const scan = await import('../../../src/features/cattle/api/scanApi')
    vi.spyOn(scan, 'scanCode').mockResolvedValue({ kind: 'otherFarm', farmId: 12 })
    const { default: ScanQrPage } = await import('../../../src/features/cattle/pages/ScanQrPage')
    const { SessionContext } = await import('../../../src/app/session/sessionContext')
    const user = userEvent.setup()
    render(
      <SessionContext.Provider value={session('OWNER', { farms: [{ id: 12, name: 'Trại Đồi Thông', role: 'MANAGER', serviceStatus: 'ACTIVE' }] })}>
        <MemoryRouter initialEntries={['/quet-qr']}><ScanQrPage /></MemoryRouter>
      </SessionContext.Provider>,
    )
    await user.type(screen.getByLabelText('Nhập mã thủ công'), 'QR-12')
    await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
    expect(await screen.findByText('Bò này thuộc Trại Đồi Thông. Chuyển sang trại đó để mở?')).toBeInTheDocument()
    expect(screen.queryByText(/#12/)).not.toBeInTheDocument()
  })
})

describe('FE-05 pen and QR history tabs', () => {
  it('shows the pen warning reason (SCR-20 #5) and QR statuses in Vietnamese (SCR-21)', async () => {
    const { mapBackendCattle } = await import('../../../src/features/cattle/api/cattleMapper')
    const { default: BarnsTab } = await import('../../../src/features/cattle/components/BarnsTab')
    const { default: QrTab } = await import('../../../src/features/cattle/components/QrTab')
    const cow = mapBackendCattle(
      { id: 1, displayCode: 'BC-001', herdStatus: 'ACTIVE' },
      { history: [{ fromDate: '2026-10-01', penCode: 'C-01', reason: 'Tách đàn', warningReason: 'Chuồng đầy tạm thời' }] },
      [
        { tagCode: 'QR-2', status: 'ACTIVE', issuedAt: '2026-10-02T01:00:00Z' },
        { tagCode: 'QR-1', status: 'REPLACED', issuedAt: '2026-01-02T01:00:00Z', reason: 'LOST' },
        { tagCode: 'QR-0', status: 'RETIRED', issuedAt: '2025-01-02T01:00:00Z' },
      ],
    )
    const { unmount } = render(<MemoryRouter><BarnsTab cow={cow} barns={{}} canWrite={false} onOpenModal={() => undefined} /></MemoryRouter>)
    expect(screen.getByText('Lý do cảnh báo: Chuồng đầy tạm thời')).toBeInTheDocument()
    unmount()
    render(<MemoryRouter><QrTab cow={cow} canWrite={false} onOpenModal={() => undefined} /></MemoryRouter>)
    expect(screen.getAllByText('Đang dùng').length).toBe(2)
    expect(screen.getByText('Đã thay')).toBeInTheDocument()
    expect(screen.getByText('Đã thu hồi')).toBeInTheDocument()
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument()
  })
})
