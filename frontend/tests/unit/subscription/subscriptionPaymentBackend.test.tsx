import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BackendError } from '../../../src/shared/api/backendClient'
import { clearCurrentFarmId, pageLoader, readCurrentFarmId } from '../../../src/app/session/currentFarm'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { createDevTransferApi } from '../../../src/features/subscription/api/devTransferApi'
import { createSubscriptionApi } from '../../../src/features/subscription/api/subscriptionApi'
import { subscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import FirstSubscriptionPage from '../../../src/features/subscription/pages/FirstSubscriptionPage'
import SubscriptionRoutes from '../../../src/features/subscription/pages/SubscriptionRoutes'
import type { Payment, SubscriptionOverview } from '../../../src/features/subscription/types'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: (id: string | number, suffix = '') => `/api/farms/${id}${suffix}` }))
vi.mock('../../../src/shared/config/runtime', async (original) => ({
  ...await original<typeof import('../../../src/shared/config/runtime')>(), backendMode: 'backend',
}))
vi.mock('../../../src/shared/api/backendTransport', () => ({ backendTransport: http }))
vi.mock('../../../src/app/session/currentFarm', async (original) => ({
  ...await original<typeof import('../../../src/app/session/currentFarm')>(), activeFarmId: 42,
}))
const NOW = Date.parse('2026-11-09T03:00:00Z')
const pending: Payment = { id: 501, quoteRef: 'BC-UC02', durationYears: 1, amountVnd: 1_200_000, state: 'PENDING',
  requestedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 86_400_000).toISOString(), priceVersionId: 7,
  bankCode: 'TESTBANK', accountNumber: 'TEST-ACCOUNT', accountName: 'TEST RECIPIENT',
  qrImageUrl: 'https://qr.sepay.vn/img?acc=TEST-ACCOUNT&bank=TESTBANK&amount=1200000&des=BC-UC02',
  bankPaidAt: null, receivedAt: null, confirmedAt: null }
const overview: SubscriptionOverview = { farmId: 42, farmName: 'Trại thật 42', serviceStatus: 'PENDING_PAYMENT', latestEnd: null,
  entitlementStatus: 'NONE', currentPrices: { id: 7, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: '2026-01-01T00:00:00Z' },
  pendingPayment: null, renewalOpensAt: null, suspended: false, suspendedSince: null, currentPeriod: null,
  daysRemaining: null, futurePeriods: [], periods: [], eligibility: { ok: true } }
const activeContext = { id: 42, name: overview.farmName, role: 'OWNER', serviceStatus: 'ACTIVE', version: 1 }
const session: Session = { role: 'OWNER', fullName: 'Test Owner', email: 'owner@example.test', farmId: 42, farmName: overview.farmName, logout: vi.fn() }
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output> }
function page(path = '/goi-dich-vu/chuyen-khoan/501?farm=42') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/dang-ky-goi" element={<FirstSubscriptionPage />} />
    <Route path="/goi-dich-vu/*" element={<SubscriptionRoutes />} />
    <Route path="*" element={<div>Destination</div>} />
  </Routes><Link to="/goi-dich-vu/chuyen-khoan/502?farm=42">Another request</Link><Where /></MemoryRouter></SessionContext.Provider>)
}
beforeEach(() => {
  http.get.mockReset(); http.command.mockReset()
  http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : pending)
  vi.spyOn(subscriptionDemoStore, 'getOverview').mockImplementation(() => { throw new Error('No demo fallback') })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('UC2 backend contract and forms', () => {
  it('posts the reviewed price and retains all real progress fields', async () => {
    const api = createSubscriptionApi({ mode: 'backend', farmId: 42, transport: http, store: subscriptionDemoStore })
    const payment = { ...pending, receivedAt: '2026-11-09T03:00:10Z', reopened: false }
    http.command.mockResolvedValue(payment)
    expect(await api.createPayment(42, { durationYears: 1, expectedPriceVersionId: 7 })).toEqual(payment)
    expect(http.command).toHaveBeenCalledWith('/api/farms/42/subscription/payments',
      { durationYears: 1, reviewedPriceVersion: 7 }, expect.any(Object))
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('requires an explicit term and shows the estimated first period and all plan terms', async () => {
    page('/dang-ky-goi?farm=42')
    const create = await screen.findByRole('button', { name: 'Tạo yêu cầu thanh toán' })
    expect(create).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /2 năm/ }))
    expect(create).toBeEnabled()
    expect(screen.getByText('Kỳ dịch vụ (ước tính)')).toBeInTheDocument()
    expect(screen.getByText('Tự động gia hạn')).toBeInTheDocument()
    http.command.mockResolvedValue({ ...pending, durationYears: 2, amountVnd: 2_160_000 })
    fireEvent.click(create)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/goi-dich-vu/chuyen-khoan/501?'))
    expect(http.command).toHaveBeenCalledWith('/api/farms/42/subscription/payments',
      { durationYears: 2, reviewedPriceVersion: 7 }, expect.objectContaining({ key: expect.any(String) }))
  })

  it('keeps the command key on a network retry and asks before reopening another term', async () => {
    page('/dang-ky-goi?farm=42')
    fireEvent.click(await screen.findByRole('radio', { name: /1 năm/ }))
    http.command.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce({ ...pending, reopened: true })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    await screen.findByText(/Network failure|Không thể/)
    const firstKey = http.command.mock.calls[0][2].key
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    expect(await screen.findByRole('dialog', { name: 'Bạn đã có yêu cầu còn hiệu lực' })).toBeInTheDocument()
    expect(http.command.mock.calls[1][2].key).toBe(firstKey)
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại hướng dẫn' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/chuyen-khoan/501?'))
  })

  it('shows a price conflict and requires another review before submitting the new price', async () => {
    page('/dang-ky-goi?farm=42')
    fireEvent.click(await screen.findByRole('radio', { name: /1 năm/ }))
    http.command.mockRejectedValue(new BackendError(409, { code: 'MSG-FE19-02', params: {
      seen: { version: 7, term: 1, amountVnd: 1_200_000 }, current: { version: 8, term: 1, amountVnd: 1_320_000 },
    } }))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    expect(await screen.findByRole('dialog', { name: 'Bảng giá đã thay đổi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem lại giá mới' })).toBeInTheDocument()
    expect(http.command).toHaveBeenCalledTimes(1)
  })

  it('renders the actual QR and retains copyable bank details when the image fails', async () => {
    // Keep this quote inside its 24-hour window regardless of the day the suite runs.
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    page()
    const qr = await screen.findByRole('img', { name: 'Mã VietQR thanh toán' })
    expect(qr).toHaveAttribute('src', pending.qrImageUrl)
    fireEvent.error(qr)
    expect(screen.getByText(/Không tải được mã QR/)).toBeInTheDocument()
    expect(screen.getByText('TEST-ACCOUNT')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Sao chép/ })).toHaveLength(5)
  })

  it('shows service status and the actual current period on the renewal form', async () => {
    const period = { paymentCode: 'OLD', durationYears: 1 as const, amountVnd: 1_200_000,
      start: '2025-11-14T17:00:00Z', end: '2026-11-14T17:00:00Z', status: 'CURRENT' as const }
    http.get.mockResolvedValue({ ...overview, serviceStatus: 'ACTIVE', currentPeriod: period, periods: [period], latestEnd: period.end })
    page('/goi-dich-vu/gia-han?farm=42')
    expect(await screen.findByText('Đang hoạt động', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('15/11/2025 → 14/11/2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' })).toBeDisabled()
  })

  it('does not claim the account was copied when the clipboard rejects the write', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    try {
      page()
      fireEvent.click(await screen.findByRole('button', { name: 'Sao chép số tài khoản' }))
      expect(await screen.findByText(/Không thể sao chép/)).toBeInTheDocument()
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('keeps the full-width transfer-content copy button on phones and reports a failed copy', async () => {
    const media = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    try {
      page()
      const copy = await screen.findByRole('button', { name: 'Sao chép nội dung chuyển khoản' })
      expect(copy).toHaveTextContent('Sao chép nội dung chuyển khoản')
      fireEvent.click(copy)
      expect(await screen.findByText(/Không thể sao chép/)).toBeInTheDocument()
      expect(copy).not.toHaveTextContent('Đã chép')
    } finally {
      if (media) Object.defineProperty(window, 'matchMedia', media)
      else Reflect.deleteProperty(window, 'matchMedia')
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})

describe('SCR-59 on phones (UI review B5)', () => {
  const phone = () => Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  let media: PropertyDescriptor | undefined
  beforeEach(() => { media = Object.getOwnPropertyDescriptor(window, 'matchMedia'); phone() })
  afterEach(() => { if (media) Object.defineProperty(window, 'matchMedia', media); else Reflect.deleteProperty(window, 'matchMedia') })

  it('names a first purchase "Đăng ký gói" and points below to the transfer details when the QR image fails', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(NOW + 60_000) // the request is still open, so its QR is shown
    try {
      page()
      expect(await screen.findByText('Đăng ký gói · Trại thật 42')).toBeInTheDocument()
      fireEvent.error(await screen.findByAltText('Mã VietQR thanh toán'))
      expect(screen.getByText('Không tải được mã QR. Vui lòng dùng thông tin chuyển khoản bên dưới.')).toBeInTheDocument()
    } finally { clock.mockRestore() }
  })

  it('names a request of a farm that already bought a period "Gia hạn gói"', async () => {
    const renewing: SubscriptionOverview = { ...overview, serviceStatus: 'ACTIVE', latestEnd: '2027-11-09T03:00:00Z',
      periods: [{ start: '2026-11-09T03:00:00Z', end: '2027-11-09T03:00:00Z', paymentCode: 'BC-EARLIER', durationYears: 1, amountVnd: 1_200_000, status: 'CURRENT' }] }
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? renewing : pending)
    page()
    expect(await screen.findByText('Gia hạn gói · Trại thật 42')).toBeInTheDocument()
  })
})

describe('five-second automatic payment status updates', () => {
  async function open(changes: Partial<Payment> = {}) {
    vi.useFakeTimers(); vi.setSystemTime(NOW)
    let value = { ...pending, ...changes }
    http.get.mockImplementation(async (path: string) => path.endsWith('/context') ? activeContext : path.endsWith('/subscription') ? overview : value)
    let view: ReturnType<typeof page>
    await act(async () => { view = page() })
    return { view: view!, set: (next: Partial<Payment>) => { value = { ...value, ...next } } }
  }
  it('refreshes every five seconds and stops after PAID without needing a button click', async () => {
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    const state = await open()
    expect(http.get).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(4999) })
    expect(http.get).toHaveBeenCalledTimes(2)
    state.set({ state: 'PAID', confirmedAt: new Date(NOW + 5000).toISOString(), purchasedStart: pending.requestedAt,
      purchasedEnd: '2027-11-09T03:00:00Z' })
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(replace.mock.calls).toEqual([['/tong-quan']])
    expect(screen.queryByRole('button', { name: 'Kiểm tra lại' })).not.toBeInTheDocument()
    const calls = http.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(http.get).toHaveBeenCalledTimes(calls)
    state.view.unmount()
  })

  it('keeps the last status after a refresh error, retries, and stops on leaving', async () => {
    const state = await open()
    http.get.mockRejectedValueOnce(new Error('Status unavailable'))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('TEST-ACCOUNT')).toBeInTheDocument()
    // MSG-FE19-08 shows the last status with its Vietnamese label, not the raw enum.
    expect(screen.getByText(/Trạng thái gần nhất: Đang chờ\./)).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(http.get).toHaveBeenCalledTimes(4)
    state.view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(http.get).toHaveBeenCalledTimes(4)
  })

  it('hides the QR at the exact expiry even when the backend still reports PENDING', async () => {
    await open({ expiresAt: new Date(NOW + 1000).toISOString() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.queryByRole('img', { name: 'Mã VietQR thanh toán' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Yêu cầu đã hết hạn' })).toBeInTheDocument()
    const calls = http.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(http.get).toHaveBeenCalledTimes(calls)
  })

  it('does not overlap slow requests and ignores a late response after navigation', async () => {
    await open()
    let finish!: (value: Payment) => void
    http.get.mockImplementationOnce(() => new Promise<Payment>((resolve) => { finish = resolve }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(http.get).toHaveBeenCalledTimes(3)
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : { ...pending, id: 502, quoteRef: 'BC-NEW' })
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Another request' })) })
    expect(screen.getByText(/Yêu cầu BC-NEW/)).toBeInTheDocument()
    await act(async () => { finish({ ...pending, state: 'PAID' }) })
    expect(screen.queryByText(/đã được xác nhận/)).not.toBeInTheDocument()
    expect(screen.getByText(/Yêu cầu BC-NEW/)).toBeInTheDocument()
  })
})

describe('local transfer simulator on SCR-59 (dev only)', () => {
  const api = () => createDevTransferApi({ mode: 'backend', transport: http, store: subscriptionDemoStore })

  it('posts the amount to the dev route and tells a confirmed transfer from an unmatched one', async () => {
    http.command.mockResolvedValueOnce({ success: true, duplicate: false, evidenceId: 9, reviewStatus: 'ACCEPTED', paymentId: 501 })
    expect(await api().simulateTransfer(42, pending, 1_200_000)).toEqual({ confirmed: true, duplicate: false })
    expect(http.command).toHaveBeenCalledWith('/api/dev/sepay/farms/42/payments/501/transfer', { amountVnd: 1_200_000 }, { method: 'POST' })
    http.command.mockResolvedValueOnce({ success: true, duplicate: false, evidenceId: 10, reviewStatus: 'TO_REVIEW', paymentId: null })
    expect(await api().simulateTransfer(42, pending, 1_000)).toEqual({ confirmed: false, duplicate: false })
    await expect(api().simulateTransfer(42, pending, 0)).rejects.toThrow('Số tiền phải là số nguyên dương.')
    expect(http.command).toHaveBeenCalledTimes(2)
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('explains a server without the simulator instead of a generic not-found', async () => {
    http.command.mockRejectedValueOnce(new BackendError(404, {}))
    await expect(api().simulateTransfer(42, pending, 1_200_000)).rejects.toThrow(/chưa bật giả lập chuyển khoản/)
  })

  it('prefills the requested amount, refreshes after sending and disappears once the request is paid', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    let value: Payment = pending
    http.get.mockImplementation(async (path: string) => path.endsWith('/context') ? activeContext : path.endsWith('/subscription') ? overview : value)
    http.command.mockImplementation(async () => {
      value = { ...pending, state: 'PAID', confirmedAt: new Date(NOW + 1000).toISOString(), purchasedStart: pending.requestedAt,
        purchasedEnd: '2027-11-09T03:00:00Z', receiptCode: 'RC-1' }
      return { success: true, duplicate: false, evidenceId: 9, reviewStatus: 'ACCEPTED', paymentId: 501 }
    })
    page()
    const amount = await screen.findByLabelText('Số tiền giả lập (VND)')
    expect(amount).toHaveValue('1200000')
    fireEvent.click(screen.getByRole('button', { name: 'Giả lập chuyển khoản' }))
    await waitFor(() => expect(replace.mock.calls).toEqual([['/tong-quan']]))
    expect(http.command).toHaveBeenCalledWith('/api/dev/sepay/farms/42/payments/501/transfer', { amountVnd: 1_200_000 }, { method: 'POST' })
    expect(screen.queryByRole('region', { name: 'Giả lập chuyển khoản' })).not.toBeInTheDocument()
  })

  it('rejects an invalid amount without calling the server', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    page()
    const amount = await screen.findByLabelText('Số tiền giả lập (VND)')
    fireEvent.change(amount, { target: { value: '12a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Giả lập chuyển khoản' }))
    expect(screen.getByText('Số tiền phải là số nguyên dương.')).toBeInTheDocument()
    expect(http.command).not.toHaveBeenCalled()
  })
})

describe('D38: the Owner cancels a payment request on SCR-59', () => {
  const api = () => createSubscriptionApi({ mode: 'backend', farmId: 42, transport: http, store: subscriptionDemoStore })
  const cancelledDto = { ...pending, state: 'CANCELLED' as const, cancelledAt: new Date(NOW + 2000).toISOString(), cancelReason: 'Chọn nhầm kỳ hạn' }

  it('TC-19-107: posts the trimmed reason with the caller key and maps MSG-FE19-19 / MSG-COM-05', async () => {
    http.command.mockResolvedValueOnce(cancelledDto)
    expect(await api().cancelPayment(42, pending, '  Chọn nhầm kỳ hạn  ', 'key-1')).toMatchObject({ state: 'CANCELLED', cancelReason: 'Chọn nhầm kỳ hạn' })
    expect(http.command).toHaveBeenLastCalledWith('/api/farms/42/subscription/payments/501/cancel', { reason: 'Chọn nhầm kỳ hạn' }, { key: 'key-1' })
    http.command.mockResolvedValueOnce({ ...cancelledDto, cancelReason: null })
    await api().cancelPayment(42, pending, '   ', 'key-2')
    expect(http.command).toHaveBeenLastCalledWith('/api/farms/42/subscription/payments/501/cancel', {}, { key: 'key-2' })
    http.command.mockRejectedValueOnce(new BackendError(409, { code: 'MSG-FE19-19', params: { code: 'BC-UC02', receivedAt: '2026-11-09T03:00:10Z' } }))
    await expect(api().cancelPayment(42, pending, '', 'key-3')).rejects.toMatchObject({ code: 'CANCEL_BLOCKED', detail: { code: 'BC-UC02', receivedAt: '2026-11-09T03:00:10Z' } })
    http.command.mockRejectedValueOnce(new BackendError(409, { code: 'MSG-COM-05' }))
    await expect(api().cancelPayment(42, pending, '', 'key-4')).rejects.toMatchObject({ code: 'STALE' })
    await expect(api().cancelPayment(42, pending, 'x'.repeat(1001), 'key-5')).rejects.toThrow(/tối đa 1\.000/)
    expect(http.command).toHaveBeenCalledTimes(4)
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('TC-19-107: confirms once with one key, then shows MSG-FE19-18 without QR, copy or cancel buttons', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    let value: Payment = pending
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : value)
    let finish!: (body: unknown) => void
    http.command.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy yêu cầu' }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Nếu bạn đã chuyển khoản, đừng hủy/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(http.command).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }))
    dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Lý do (không bắt buộc)'), { target: { value: ' Chọn nhầm kỳ hạn ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy yêu cầu' }))
    const busy = await within(dialog).findByRole('button', { name: 'Đang hủy…' })
    expect(busy).toBeDisabled()
    fireEvent.click(busy)
    expect(http.command).toHaveBeenCalledTimes(1)
    const [path, body, options] = http.command.mock.calls[0]
    expect(path).toBe('/api/farms/42/subscription/payments/501/cancel')
    expect(body).toEqual({ reason: 'Chọn nhầm kỳ hạn' })
    expect(options.key).toMatch(/^[0-9a-f-]{36}$/)
    value = cancelledDto
    await act(async () => { finish(cancelledDto) })

    expect(await screen.findByText(/Yêu cầu thanh toán BC-UC02 đã hủy lúc/)).toBeInTheDocument()
    expect(screen.getByText(/Đừng chuyển khoản vào mã này/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Mã VietQR thanh toán' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Yêu cầu đã hủy').length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('button', { name: /^Sao chép/ })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo yêu cầu mới' })).toBeInTheDocument()
    // The bank step no longer says "Đang chờ" once the request is cancelled.
    const bankStep = screen.getByText('Ngân hàng ghi nhận giao dịch').closest('tr')!
    expect(within(bankStep).getByText('Chưa')).toBeInTheDocument()
    expect(within(bankStep).queryByText('Đang chờ')).not.toBeInTheDocument()
    expect(within(screen.getByText('Đã hủy yêu cầu').closest('tr')!).getByText('Xong')).toBeInTheDocument()
  })

  it('TC-19-108: no cancel button once a transfer was received; a refused cancel shows MSG-FE19-19 and reloads', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const received = { ...pending, receivedAt: new Date(NOW - 5000).toISOString() }
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : received)
    const view = page()
    await screen.findByText('Ngân hàng ghi nhận giao dịch')
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).not.toBeInTheDocument()
    view.unmount()

    let value: Payment = pending
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : value)
    http.command.mockImplementation(async () => {
      value = received
      throw new BackendError(409, { code: 'MSG-FE19-19', params: { code: 'BC-UC02', receivedAt: received.receivedAt } })
    })
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy yêu cầu' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy yêu cầu' }))
    expect(await screen.findByText('Không hủy được yêu cầu')).toBeInTheDocument()
    expect(screen.getByText(/đã nhận giao dịch ngân hàng lúc .* nên không hủy được nữa/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).not.toBeInTheDocument())
  })

  it('TC-19-108: a stale cancel closes the dialog and enters the farm when the status read confirms payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    let value: Payment = pending
    http.get.mockImplementation(async (path: string) => path.endsWith('/context') ? activeContext : path.endsWith('/subscription') ? overview : value)
    http.command.mockImplementation(async () => {
      value = { ...pending, state: 'PAID', confirmedAt: new Date(NOW).toISOString(), purchasedStart: pending.requestedAt, purchasedEnd: '2027-11-09T03:00:00Z' }
      throw new BackendError(409, { code: 'MSG-COM-05' })
    })
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy yêu cầu' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy yêu cầu' }))
    await waitFor(() => expect(replace.mock.calls).toEqual([['/tong-quan']]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('SCR-59 automatic farm entry after a confirmed payment (UC-FE02-02)', () => {
  // Farm 77 differs from the per-load fallback farm (activeFarmId 42) and from session.farmId (42): entering either of
  // those instead of the paid farm is exactly the original bug (a fresh tab used to fall back to a configured farm).
  const FARM = 77
  const guide = `/goi-dich-vu/chuyen-khoan/501?farm=${FARM}`
  const paid: Payment = { ...pending, state: 'PAID', confirmedAt: new Date(NOW + 1000).toISOString(),
    purchasedStart: pending.requestedAt, purchasedEnd: '2027-11-09T03:00:00Z' }
  const farmOverview = { ...overview, farmId: FARM, farmName: 'Trại mới 77' }
  const context = { ...activeContext, id: FARM, name: farmOverview.farmName, version: 3 }
  const contextOf = (path: string) => path === `/api/farms/${FARM}/context`
  const answer = (onContext: (path: string) => Promise<unknown>) => http.get.mockImplementation((path: string) => contextOf(path)
    ? onContext(path)
    : path.endsWith('/context') ? Promise.reject(new Error(`unexpected farm check ${path}`))
      : Promise.resolve(path.endsWith('/subscription') ? farmOverview : paid))
  beforeEach(() => { clearCurrentFarmId(); vi.spyOn(Date, 'now').mockReturnValue(NOW) })
  afterEach(() => clearCurrentFarmId())

  it('automatically checks the paid farm once, keeps it for this tab and replaces the guide', async () => {
    let resolveContext!: (value: unknown) => void
    answer(() => new Promise((resolve) => { resolveContext = resolve }))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    page(guide)
    expect(await screen.findByText('Đang vào trại…')).toBeInTheDocument()
    await act(async () => { resolveContext(context) })
    await waitFor(() => expect(replace.mock.calls).toEqual([['/tong-quan']]))
    expect(http.get.mock.calls.filter(([path]) => String(path).endsWith('/context'))).toEqual([[`/api/farms/${FARM}/context`]])
    expect(readCurrentFarmId()).toBe(FARM)
    // Not a bare route change: that kept every farm API on the configured fallback farm (403 on the new farm's pages).
    expect(screen.queryByText('Destination')).not.toBeInTheDocument()
  })

  it('stays on the guide and explains why when the farm cannot be entered', async () => {
    answer(() => Promise.reject(new BackendError(403, { code: 'MSG-FE02-03' })))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    page(guide)
    const dialog = await screen.findByRole('dialog', { name: 'Thanh toán thành công' })
    expect(within(dialog).getByText('Trang trại chưa thể sử dụng dịch vụ. Chủ trại cần kiểm tra gói dịch vụ.')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(readCurrentFarmId()).toBeNull()
    answer(() => Promise.resolve(context))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thử vào trại lại' }))
    await waitFor(() => expect(replace.mock.calls).toEqual([['/tong-quan']]))
  })

  it('says the browser blocks site data instead of leaving the button disabled when the farm cannot be kept', async () => {
    answer(() => Promise.resolve(context))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    page(guide)
    expect(await screen.findByText(/Trình duyệt đang chặn lưu dữ liệu/)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Thử vào trại lại' })).toBeEnabled()
  })

  it('still enters the farm when only the optional confirmation cannot be kept', async () => {
    answer(() => Promise.resolve(context))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'beefcare.subscription.paymentSuccess') throw new Error('quota')
      setItem.call(this, key, value)
    })
    page(guide)
    await waitFor(() => expect(replace.mock.calls).toEqual([['/tong-quan']]))
    expect(readCurrentFarmId()).toBe(FARM)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the Vietnamese connection message, not the raw browser error, when the farm check cannot reach the server', async () => {
    answer(() => Promise.reject(new TypeError('Failed to fetch')))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    page(guide)
    expect(await screen.findByText(/Không thể kết nối máy chủ/)).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Thử vào trại lại' })).toBeEnabled()
  })

  it('keeps a paid but suspended farm out of the dashboard', async () => {
    answer(() => Promise.resolve({ ...context, serviceStatus: 'SUSPENDED' }))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    page(guide)
    const dialog = await screen.findByRole('dialog', { name: 'Thanh toán thành công' })
    expect(within(dialog).getByText(/đang ở trạng thái Tạm ngưng\. Chỉ dùng được thông tin trại, gói dịch vụ và hỗ trợ\./i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/liên hệ Chủ trại/)).not.toBeInTheDocument()
    expect(readCurrentFarmId()).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('ignores the farm check when the guide is left before it finishes', async () => {
    let resolveContext!: (value: unknown) => void
    answer(() => new Promise((resolve) => { resolveContext = resolve }))
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    const view = page(guide)
    expect(await screen.findByText('Đang vào trại…')).toBeInTheDocument()
    view.unmount()
    await act(async () => { resolveContext(context) })
    expect(readCurrentFarmId()).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})
