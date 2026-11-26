import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

// The page layouts need a full app shell; the pen screen behaviour under test does not.
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/layouts/TechnicianLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

const TODAY = '2026-11-16'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const pen = (id: number, code: string, status = 'ACTIVE', extra: Record<string, unknown> = {}) =>
  ({ id, code, name: `Chuồng ${code}`, capacity: 10, headcount: 2, freePlaces: 8, status, version: 1, ...extra })
const cattle = [
  { id: 41, version: 0, code: 'BC-0041', earTagNumber: 'ET-41', sex: 'FEMALE', lifeStage: 'ADULT', sinceDate: '2026-11-01', latestWeightKg: 312.5, hints: [] },
  { id: 42, version: 3, code: 'BC-0042', earTagNumber: null, sex: null, lifeStage: null, sinceDate: null, latestWeightKg: null, hints: [] },
]

type Route = (path: string, init?: RequestInit) => Response | undefined
function stubBackend(route: Route) {
  const calls: Array<{ path: string; method: string; body: unknown }> = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://backend.test').pathname
    const method = init?.method ?? 'GET'
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (path === '/api/csrf') return json({ token: 'csrf' })
    const response = route(path, init)
    if (response) return response
    throw new Error(`Unexpected request: ${method} ${path}`)
  })
  return calls
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

async function renderBarnList(entry = '/chuong-trai') {
  const { default: BarnList } = await import('../../../src/features/pen-management/pages/BarnList')
  render(<MemoryRouter initialEntries={[entry]}><BarnList /><LocationProbe /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
  sessionStorage.setItem('beefcare.currentFarmId', '9')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  sessionStorage.removeItem('beefcare.currentFarmId')
})

describe('pen members (popup Chuyển chuồng #5)', () => {
  it('reads MemberList.items returned by GET /members and keeps ACTIVE members only', async () => {
    stubBackend((path) => path === '/api/farms/9/members' ? json({ farmName: 'Trại 9', counts: { all: 2 }, items: [
      { id: 3, userId: 11, fullName: 'Nguyễn An', email: 'a@example.test', role: 'MANAGER', status: 'ACTIVE' },
      { id: 4, userId: 12, fullName: 'Trần Bình', email: 'b@example.test', role: 'WORKER', status: 'REMOVED' },
    ] }) : undefined)
    const { penApi } = await import('../../../src/features/pen-management/api/penApi')
    expect(await penApi.listPenMembers()).toEqual([{ id: 3, userId: 11, fullName: 'Nguyễn An', email: 'a@example.test', role: 'MANAGER' }])
  })

  it('shows the selected cattle and sends the chosen performer as performedBy (app-user id)', async () => {
    const calls = stubBackend((path) => {
      if (path === '/api/farms/9/members') return json({ items: [
        { id: 3, userId: 11, fullName: 'Nguyễn An', role: 'MANAGER', status: 'ACTIVE' },
        { id: 5, userId: 15, fullName: 'Lê Cường', role: 'TECHNICIAN', status: 'ACTIVE' },
      ] })
      if (path === '/api/farms/9/pen-moves/check') return json({ destinationActive: true, capacity: 10, freePlaces: 8, movingCount: 2, blocked: false,
        cattle: cattle.map((c) => ({ cattleId: c.id, cattleCode: c.code, currentPenCode: 'A', currentFromDate: '2026-11-01', results: [] })) })
      if (path === '/api/farms/9/pen-moves') return json({ moved: [{ cattleId: 41 }, { cattleId: 42 }], skipped: [] })
      return undefined
    })
    const [{ default: MoveDialog }, { mapBackendPen, mapBackendPenDetail }] = await Promise.all([
      import('../../../src/features/pen-management/components/MoveDialog'),
      import('../../../src/features/pen-management/api/penApi'),
    ])
    const from = mapBackendPenDetail({ ...pen(11, 'A'), cattle })
    const onMoved = vi.fn()
    render(<MemoryRouter><MoveDialog from={from} cattle={from.cattleInPen} pens={[from, mapBackendPen(pen(12, 'B'))]} today={TODAY} onClose={vi.fn()} onMoved={onMoved} /></MemoryRouter>)

    expect(screen.getByText('ET-41')).toBeInTheDocument()
    expect(screen.getByText('Cái')).toBeInTheDocument()
    expect(screen.getByText('Trưởng thành')).toBeInTheDocument()
    expect(screen.getByText('312.5 kg')).toBeInTheDocument()
    const row42 = screen.getAllByText('BC-0042')[0].closest('tr')!
    expect(within(row42).getAllByText('—')).toHaveLength(5)

    const performer = screen.getByRole('combobox', { name: 'Người thực hiện' })
    // Không có phiên đăng nhập (render ngoài SessionProvider): để trống = "Người đang đăng nhập", không tự chọn thành viên đầu.
    await waitFor(() => expect(within(performer).getAllByRole('option')).toHaveLength(3))
    expect(performer).toHaveValue('')
    const user = userEvent.setup()
    await user.selectOptions(performer, '15')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B')
    await user.click(screen.getByRole('button', { name: 'Sửa nhầm (chuyển ngược)' }))
    expect(screen.getByDisplayValue('Correction')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Xác nhận chuyển' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith('Đã chuyển 2 con sang B.'))
    expect(calls.find((c) => c.path === '/api/farms/9/pen-moves')?.body).toEqual(expect.objectContaining({ performedBy: 15, reason: 'Correction' }))
  })

  it('defaults the performer to the signed-in member, and leaves it empty when that user is not in the member list', async () => {
    stubBackend((path) => {
      if (path === '/api/farms/9/members') return json({ items: [
        { id: 3, userId: 11, fullName: 'Nguyễn An', role: 'MANAGER', status: 'ACTIVE' },
        { id: 5, userId: 15, fullName: 'Lê Cường', role: 'TECHNICIAN', status: 'ACTIVE' },
      ] })
      return undefined
    })
    const [{ default: MoveDialog }, { mapBackendPen, mapBackendPenDetail }, { SessionContext }] = await Promise.all([
      import('../../../src/features/pen-management/components/MoveDialog'),
      import('../../../src/features/pen-management/api/penApi'),
      import('../../../src/app/session/sessionContext'),
    ])
    const from = mapBackendPenDetail({ ...pen(11, 'A'), cattle })
    const dialog = (userId: number) => (
      <SessionContext.Provider value={{ id: userId, fullName: 'x', email: 'x@example.test', role: 'MANAGER' } as never}>
        <MemoryRouter><MoveDialog from={from} cattle={from.cattleInPen} pens={[from, mapBackendPen(pen(12, 'B'))]} today={TODAY} onClose={vi.fn()} onMoved={vi.fn()} /></MemoryRouter>
      </SessionContext.Provider>
    )
    const { unmount } = render(dialog(15))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Người thực hiện' })).toHaveValue('15'))
    unmount()

    render(dialog(99))
    const performer = screen.getByRole('combobox', { name: 'Người thực hiện' })
    await waitFor(() => expect(within(performer).getAllByRole('option')).toHaveLength(3))
    expect(performer).toHaveValue('')
  })

  it('"Dùng chung lý do" fills only the empty warning reasons', async () => {
    const three = [...cattle, { ...cattle[1], id: 43, code: 'BC-0043' }]
    stubBackend((path) => {
      if (path === '/api/farms/9/members') return json({ items: [] })
      if (path === '/api/farms/9/pen-moves/check') return json({ destinationActive: true, capacity: 10, freePlaces: 8, movingCount: 3, blocked: false,
        cattle: three.map((c) => ({ cattleId: c.id, cattleCode: c.code, currentPenCode: 'A', currentFromDate: '2026-11-01', warningReasonRequired: true,
          results: [{ criterion: 'SEX', outcome: 'NOT_MET' }] })) })
      return undefined
    })
    const [{ default: MoveDialog }, { mapBackendPen, mapBackendPenDetail }] = await Promise.all([
      import('../../../src/features/pen-management/components/MoveDialog'),
      import('../../../src/features/pen-management/api/penApi'),
    ])
    const from = mapBackendPenDetail({ ...pen(11, 'A'), cattle: three })
    render(<MemoryRouter><MoveDialog from={from} cattle={from.cattleInPen} pens={[from, mapBackendPen(pen(12, 'B'))]} today={TODAY} onClose={vi.fn()} onMoved={vi.fn()} /></MemoryRouter>)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B')
    await user.type(await screen.findByLabelText('Lý do cảnh báo BC-0042'), 'Chủ trại đồng ý')
    await user.type(screen.getByLabelText('Lý do cảnh báo BC-0043'), 'Riêng')
    await user.click(screen.getByRole('button', { name: 'Dùng chung lý do cho các con không đạt' }))
    expect(screen.getByLabelText('Lý do cảnh báo BC-0041')).toHaveValue('Chủ trại đồng ý')
    expect(screen.getByLabelText('Lý do cảnh báo BC-0043')).toHaveValue('Riêng')
  })
})

describe('SCR-17 pen screen', () => {
  it('shows a load error with retry instead of "Chuồng chưa có bò"', async () => {
    let detailCalls = 0
    stubBackend((path) => {
      if (path === '/api/farms/9/pens') return json([pen(11, 'A')])
      if (path === '/api/farms/9/pens/11') { detailCalls += 1; return detailCalls === 1 ? json({ code: 'MSG-COM-03' }, 500) : json({ ...pen(11, 'A'), cattle }) }
      return undefined
    })
    await renderBarnList()
    expect(await screen.findByText(/Không tải được chi tiết chuồng/)).toBeInTheDocument()
    expect(screen.queryByText('Chuồng chưa có bò')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('BC-0041')).toBeInTheDocument()
    expect(screen.queryByText(/Không tải được chi tiết chuồng/)).not.toBeInTheDocument()
  })

  it('status filter uses Vietnamese labels and the detail follows the filtered list', async () => {
    stubBackend((path) => {
      if (path === '/api/farms/9/pens') return json([pen(11, 'A'), pen(12, 'E', 'INACTIVE')])
      if (path === '/api/farms/9/pens/11') return json({ ...pen(11, 'A'), cattle: [] })
      if (path === '/api/farms/9/pens/12') return json({ ...pen(12, 'E', 'INACTIVE'), cattle: [] })
      return undefined
    })
    await renderBarnList('/chuong-trai?barn=A')
    expect(await screen.findByRole('heading', { name: /A – Chuồng A/ })).toBeInTheDocument()
    const status = screen.getAllByRole('combobox').find((c) => within(c).queryByRole('option', { name: 'Ngừng hoạt động' }))!
    expect(within(status).queryByRole('option', { name: 'INACTIVE' })).not.toBeInTheDocument()
    await userEvent.setup().selectOptions(status, 'INACTIVE')
    expect(await screen.findByRole('heading', { name: /E – Chuồng E/ })).toBeInTheDocument()
    expect(screen.getByText('8 · không nhận bò mới')).toBeInTheDocument()
    // Filtering never rewrites the URL.
    expect(screen.getByTestId('location')).toHaveTextContent('?barn=A')
  })

  it('renaming a pen code updates (not creates) and keeps the renamed pen selected', async () => {
    let renamed = false
    const calls = stubBackend((path, init) => {
      if (path === '/api/farms/9/pens') return json(renamed ? [pen(10, 'A0'), pen(11, 'B5', 'ACTIVE', { version: 2 })] : [pen(10, 'A0'), pen(11, 'A1')])
      if (path === '/api/farms/9/pens/10') return json({ ...pen(10, 'A0'), cattle: [] })
      if (path === '/api/farms/9/pens/11' && init?.method === 'PUT') { renamed = true; return json(pen(11, 'B5', 'ACTIVE', { version: 2 })) }
      if (path === '/api/farms/9/pens/11') return json({ ...(renamed ? pen(11, 'B5', 'ACTIVE', { version: 2 }) : pen(11, 'A1')), cattle: [] })
      return undefined
    })
    await renderBarnList('/chuong-trai?barn=A1')
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: /A1 – Chuồng A1/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Sửa/ }))
    const code = await screen.findByDisplayValue('A1')
    await user.clear(code)
    await user.type(code, 'A0')
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(await screen.findByText('Mã chuồng A0 đã tồn tại trong trại.')).toBeInTheDocument()
    await user.clear(code)
    await user.type(code, 'B5')
    expect(screen.getByText(/Nhớ đổi biển chuồng/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))

    expect(await screen.findByRole('heading', { name: /B5 – Chuồng B5/ })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('?barn=B5')
    expect(calls.filter((c) => c.path === '/api/farms/9/pens' && c.method === 'POST')).toHaveLength(0)
    expect(calls.find((c) => c.path === '/api/farms/9/pens/11' && c.method === 'PUT')?.body).toEqual(expect.objectContaining({ code: 'B5' }))
  })
})
