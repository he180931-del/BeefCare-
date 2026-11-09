import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { createSubscriptionApi } from '../../../src/features/subscription/api/subscriptionApi'
import { subscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import SubscriptionRoutes from '../../../src/features/subscription/pages/SubscriptionRoutes'
import type { Payment, SubscriptionOverview } from '../../../src/features/subscription/types'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: (id: string | number, suffix = '') => `/api/farms/${id}${suffix}` }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))
const pending: Payment = { id: 501, quoteRef: 'BC-HISTORY', durationYears: 1, amountVnd: 1_200_000, state: 'PENDING',
  requestedAt: '2026-11-08T03:00:01Z', expiresAt: new Date(Date.now() + 86_400_000).toISOString(), priceVersionId: 7,
  bankCode: 'TESTBANK', accountNumber: 'TEST-ACCOUNT', accountName: 'TEST RECIPIENT', bankPaidAt: null, receivedAt: null, confirmedAt: null }
const paid: Payment = { ...pending, id: 502, quoteRef: 'BC-PAID', state: 'PAID',
  bankPaidAt: '2026-11-08T03:01:02Z', receivedAt: '2026-11-08T03:02:03Z', confirmedAt: '2026-11-08T03:03:04Z',
  purchasedStart: '2026-11-08T03:03:04Z', purchasedEnd: '2027-11-08T03:03:04Z' }
const expired: Payment = { ...pending, id: 503, quoteRef: 'BC-EXPIRED', state: 'EXPIRED', expiresAt: '2026-11-09T03:00:01Z' }
const overview: SubscriptionOverview = { farmId: 42, farmName: 'Trại lịch sử', serviceStatus: 'SUSPENDED', latestEnd: null,
  entitlementStatus: 'NONE', currentPrices: null, pendingPayment: null, renewalOpensAt: null, suspended: true,
  suspendedSince: '2026-11-09T00:00:00Z', currentPeriod: null, daysRemaining: null, futurePeriods: [], periods: [], eligibility: { ok: false, reason: 'SUSPENDED' } }
const session: Session = { role: 'OWNER', fullName: 'Test Owner', email: 'history@example.test', farmId: 42, farmName: overview.farmName, logout: vi.fn() }
const pageOf = (content: Payment[], number = 0, totalElements = content.length) => ({ content, number, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20) })
const listCalls = () => http.get.mock.calls.map(([path]) => String(path)).filter((path) => new URL(path, 'http://test').pathname.endsWith('/payments'))
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output> }
function page(path = '/goi-dich-vu/lich-su?farm=42') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/goi-dich-vu/*" element={<SubscriptionRoutes />} />
  </Routes><Link to="/goi-dich-vu/lich-su?farm=43">Trại khác</Link><Where /></MemoryRouter></SessionContext.Provider>)
}
beforeEach(() => {
  sessionStorage.clear(); http.get.mockReset(); http.command.mockReset()
  http.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://test')
    if (url.pathname.endsWith('/subscription')) return { ...overview, farmId: Number(url.pathname.split('/')[3]) }
    if (url.pathname.endsWith('/payments')) return pageOf([pending, paid, expired])
    return [pending, paid, expired].find((p) => url.pathname.endsWith(`/${p.id}`))
  })
  vi.spyOn(subscriptionDemoStore, 'listPayments').mockImplementation(() => { throw new Error('No demo fallback') })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('UC3 backend history contract', () => {
  it('sends filters/sort/page to the backend and keeps real paged data', async () => {
    const api = createSubscriptionApi({ mode: 'backend', farmId: 42, transport: http, store: subscriptionDemoStore })
    http.get.mockResolvedValue(pageOf([paid], 1, 21))
    const result = await api.listPayments(42, { q: ' aLpHa ', state: 'PAID', from: '2026-11-08', to: '2026-11-09', sort: 'expiresAt', dir: 'asc', page: 1 })
    const query = new URL(http.get.mock.calls[0][0], 'http://test').searchParams
    expect(Object.fromEntries(query)).toEqual({ q: 'aLpHa', status: 'PAID', from: '2026-11-08', to: '2026-11-09', sort: 'expiresAt', dir: 'asc', page: '1' })
    expect(result).toEqual(pageOf([paid], 1, 21))
    expect(subscriptionDemoStore.listPayments).not.toHaveBeenCalled()
  })

  it('rejects an invalid date range before issuing HTTP', async () => {
    const api = createSubscriptionApi({ mode: 'backend', farmId: 42, transport: http, store: subscriptionDemoStore })
    await expect(api.listPayments(42, { from: '2026-11-09', to: '2026-11-08' })).rejects.toThrow(/bắt đầu|từ/)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('does not poll history while idle and validates dates below the filters', async () => {
    vi.useFakeTimers()
    let view!: ReturnType<typeof page>
    await act(async () => { view = page() })
    const count = listCalls().length
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(listCalls()).toHaveLength(count)
    view.unmount(); vi.useRealTimers()
    page()
    await screen.findByText('BC-HISTORY')
    const dates = screen.getAllByLabelText('Chọn ngày')
    fireEvent.change(dates[0], { target: { value: '2026-11-09' } })
    await waitFor(() => expect(listCalls().at(-1)).toContain('from=2026-11-09'))
    const before = listCalls().length
    fireEvent.change(dates[1], { target: { value: '2026-11-08' } })
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc')
    expect(error).not.toHaveTextContent('MSG-COM-11')
    // MSG-COM-11 is inline under the field: the last valid list stays and no list-level retry is offered.
    expect(dates[1].parentElement?.parentElement).toContainElement(error)
    expect(screen.getByText('BC-HISTORY')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
    expect(listCalls()).toHaveLength(before)
    fireEvent.change(dates[0], { target: { value: '2026-11-07' } })
    await waitFor(() => expect(listCalls().at(-1)).toContain('from=2026-11-07&to=2026-11-08'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('searches once after typing pauses and keeps the table while reloading', async () => {
    page()
    await screen.findByText('BC-HISTORY')
    const search = screen.getByLabelText('Tìm mã thanh toán')
    for (const value of ['B', 'BC', 'BC-H']) fireEvent.change(search, { target: { value } })
    await waitFor(() => expect(listCalls().some((path) => path.includes('q=BC-H'))).toBe(true))
    expect(listCalls().filter((path) => /[?&]q=/.test(path))).toHaveLength(1)
    let release!: (value: unknown) => void
    http.get.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(screen.getByText('BC-HISTORY').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true'))
    expect(screen.queryByText('Đang tải…')).not.toBeInTheDocument()
    await act(async () => { release(pageOf([paid])) })
    expect(await screen.findByText('BC-PAID')).toBeInTheDocument()
    expect(screen.queryByText('BC-HISTORY')).not.toBeInTheDocument()
  })

  it('scrolls the detail panel into view and focuses it when a row is opened', async () => {
    const original = Element.prototype.scrollIntoView
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    try {
      page('/goi-dich-vu/lich-su/502?farm=42')
      const heading = await screen.findByRole('heading', { name: 'Chi tiết thanh toán' })
      await waitFor(() => expect(heading).toHaveFocus())
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
      const pager = screen.getByRole('navigation', { name: 'Phân trang' })
      expect(pager.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('shows PAID and EXPIRED in an inline read-only detail panel with seconds and null placeholders', async () => {
    const view = page('/goi-dich-vu/lich-su/502?farm=42')
    const detail = await screen.findByRole('region', { name: 'Chi tiết thanh toán' })
    for (const time of ['08/11/2026 10:01:02', '08/11/2026 10:02:03', '08/11/2026 10:03:04']) expect(within(detail).getByText(time)).toBeInTheDocument()
    expect(within(detail).getByText('Trại lịch sử')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    view.unmount()
    page('/goi-dich-vu/lich-su/503?farm=42')
    const expiredDetail = await screen.findByRole('region', { name: 'Chi tiết thanh toán' })
    expect(within(expiredDetail).getByText('BC-EXPIRED')).toBeInTheDocument()
    expect(within(expiredDetail).getAllByText('—')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Tạo yêu cầu mới' })).not.toBeInTheDocument()
    expect(http.command).not.toHaveBeenCalled()
  })

  it('reopens with the numeric id and refreshes on return while preserving the farm filters', async () => {
    page()
    fireEvent.change(await screen.findByLabelText('Tìm mã thanh toán'), { target: { value: 'HISTORY' } })
    await waitFor(() => expect(listCalls().some((path) => path.includes('q=HISTORY'))).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/chuyen-khoan/501?'))
    const before = listCalls().length
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng hướng dẫn' }))
    expect(await screen.findByLabelText('Tìm mã thanh toán')).toHaveValue('HISTORY')
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before))
    expect(listCalls().at(-1)).toContain('q=HISTORY')
    expect(http.command).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Trại khác' }))
    expect(await screen.findByLabelText('Tìm mã thanh toán')).toHaveValue('')
  })

  it('pages on the server, resets the page for sorting/filtering and refreshes on demand', async () => {
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname.endsWith('/subscription')) return overview
      const number = Number(url.searchParams.get('page') ?? 0)
      return pageOf(number ? [expired] : Array.from({ length: 20 }, (_, i) => ({ ...paid, id: 600 + i, quoteRef: `BC-ROW-${i}` })), number, 21)
    })
    page()
    const pager = await screen.findByRole('navigation', { name: 'Phân trang' })
    expect(screen.getAllByRole('button', { name: /^Xem BC-ROW-/ })).toHaveLength(20)
    fireEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }))
    await screen.findByText('BC-EXPIRED')
    expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('page')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo Hết hạn' }))
    await waitFor(() => expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('page')).toBe('0'))
    expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('sort')).toBe('expiresAt')
    const calls = listCalls().length
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(listCalls()).toHaveLength(calls + 1))
  })

  it('handles list failure/retry, malformed responses and empty filtered results without demo data', async () => {
    http.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/subscription')) return overview
      throw new Error('Không tải được danh sách (MSG-COM-03).')
    })
    page()
    await screen.findByText(/Không tải được danh sách/)
    http.get.mockResolvedValueOnce({ unexpected: 'response' })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText(/không đầy đủ|không hợp lệ/)
    http.get.mockResolvedValueOnce(pageOf([]))
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa có thanh toán nào')).toBeInTheDocument()
    http.get.mockResolvedValue(pageOf([]))
    fireEvent.change(screen.getByLabelText('Tìm mã thanh toán'), { target: { value: 'NONE' } })
    expect(await screen.findByText('Không có thanh toán phù hợp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeInTheDocument()
  })
})
