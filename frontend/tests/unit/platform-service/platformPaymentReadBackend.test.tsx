import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import PaymentReconciliationRoutes from '../../../src/features/platform-service/pages/PaymentReconciliationRoutes'
import { platformServiceDemoStore } from '../../../src/features/platform-service/data/platformServiceDemoStore'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))
const session: Session = { role: 'PM', fullName: 'PM UC5', email: 'uc5@example.test', farmId: null, farmName: null, logout: async () => {} }
const row = (id = 742) => ({ id, provider: 'SEPAY', environment: 'TEST', accountNamespace: 'UC5-NAMESPACE',
  maskedTransactionId: '****5678', amount: 1200000, direction: 'IN', content: 'Transfer BCUC5', bankPaidAt: '2026-10-28T01:02:03Z',
  reviewStatus: 'TO_REVIEW', matchResult: 'EXACT_CODE', reviewReason: null, receivingAccountMatches: true, paymentId: null, paymentCode: null, version: 3 })
const detail = (id = 742) => ({ summary: row(id), transactionId: '12345678', receivingAccount: 'UC5-ACCOUNT', bank: 'TESTBANK',
  referenceCode: 'BANK-REF', quoteRef: 'BCUC5', firstReceivedAt: '2026-10-28T01:02:04Z',
  history: [{ id: 1, source: 'REVIEW', action: 'HOLD', reason: 'Stored reason TK-5', reference: null, result: null,
    pmId: 82, pmName: 'PM persisted', at: '2026-10-28T01:03:00Z' }] })
const payment = (id = 502) => ({ id, farmId: 42, farmName: 'Trại UC5', quoteRef: 'BCUC5PAID', termYears: 1, amount: 1200000,
  state: 'PAID', requestedAt: '2026-10-28T00:00:00Z', expiresAt: '2026-10-29T00:00:00Z', purchasedStart: '2026-10-28T02:00:00Z',
  purchasedEnd: '2027-10-28T02:00:00Z', receiptCode: 'RC-UC5', requestedByEmail: 'requester@example.test', priceVersionId: 7,
  evidenceId: 742, confirmedAt: '2026-10-28T01:02:06Z', confirmationSource: 'SEPAY', bankPaidAt: '2026-10-28T01:02:03Z', receivedAt: '2026-10-28T01:02:04Z' })
const pageOf = (items: unknown[], page = 0, total = items.length) => ({ items, total, page, size: 20 })
const candidate = { paymentId: 601, quoteRef: 'BCCANDIDATE', farmId: 42, farmName: 'Trại ứng viên', amount: 1200000, termYears: 1,
  expiresAt: '2026-10-29T00:00:00Z', accountNamespace: 'UC5-NAMESPACE' }
const urls = () => http.get.mock.calls.map(([path]) => String(path))
const listCalls = (tab = 'evidence') => urls().filter((path) => new URL(path, 'http://test').pathname === `/api/platform/payments${tab === 'evidence' ? '/evidence' : ''}`)
function CurrentSearch() { return <output aria-label="Tham số URL">{useLocation().search}</output> }
function page(path = '/nen-tang/thanh-toan') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/nen-tang/thanh-toan" element={<PaymentReconciliationRoutes />} /></Routes><CurrentSearch />
  </MemoryRouter></SessionContext.Provider>)
}
beforeEach(() => {
  http.get.mockReset(); http.command.mockReset(); sessionStorage.clear()
  vi.spyOn(platformServiceDemoStore, 'listEvidence'); vi.spyOn(platformServiceDemoStore, 'listPayments')
  http.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://test')
    if (url.pathname.endsWith('/summary')) return { pendingRequests: 5, evidenceToReview: 6, hold: 7, lockedForReturn: 8 }
    if (url.pathname.endsWith('/candidates')) return [candidate]
    if (url.pathname.endsWith('/evidence')) return pageOf([row()])
    if (/\/evidence\/\d+$/.test(url.pathname)) return detail(Number(url.pathname.split('/').at(-1)))
    if (url.pathname === '/api/platform/payments') return pageOf([payment()])
    return payment(Number(url.pathname.split('/').at(-1)))
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('UC5 backend read workbench', () => {
  it('reads both global counts and ALL evidence, masks the list and displays persisted detail/history/candidates without commands', async () => {
    page()
    const list = await screen.findByRole('table', { name: 'Chứng từ ngân hàng' })
    expect(within(list).getByText('****5678')).toBeInTheDocument()
    expect(within(list).queryByText('12345678')).not.toBeInTheDocument()
    expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('status')).toBe('ALL')
    expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('size')).toBe('20')
    expect(await screen.findByText('UC5-NAMESPACE')).toBeInTheDocument()
    expect(await screen.findByText('Stored reason TK-5')).toBeInTheDocument()
    expect(screen.getByText('PM persisted')).toBeInTheDocument()
    expect(await screen.findByText('BCCANDIDATE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kiểm tra và chấp nhận|Khóa chờ hoàn|Tra cứu/ })).not.toBeInTheDocument()
    expect(http.command).not.toHaveBeenCalled()
    expect(platformServiceDemoStore.listEvidence).not.toHaveBeenCalled()
  })

  it('validates reversed bank dates inline, makes no invalid request and keeps the last valid list', async () => {
    page(); await screen.findByText('****5678')
    fireEvent.change(screen.getByLabelText('Ngày ngân hàng từ'), { target: { value: '2026-10-29' } })
    await waitFor(() => expect(listCalls().at(-1)).toContain('bankFrom=2026-10-29'))
    const count = listCalls().length
    fireEvent.change(screen.getByLabelText('Ngày ngân hàng đến'), { target: { value: '2026-10-28' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc')
    expect(screen.getByText('****5678')).toBeInTheDocument()
    expect(listCalls()).toHaveLength(count)
  })

  it('pages evidence on the server and resets the page when a status changes', async () => {
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname.endsWith('/evidence')) return pageOf([row(url.searchParams.get('page') === '1' ? 743 : 742)], Number(url.searchParams.get('page') ?? 0), 21)
      return original(path)
    })
    page(); await screen.findByText('****5678')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(listCalls().at(-1)).toContain('page=1'))
    fireEvent.change(screen.getByLabelText('Trạng thái xem xét'), { target: { value: 'HOLD' } })
    await waitFor(() => expect(listCalls().at(-1)).toContain('status=HOLD'))
    expect(new URL(listCalls().at(-1)!, 'http://test').searchParams.get('page')).toBe('0')
    expect(urls().filter((path) => path.endsWith('/summary'))).toHaveLength(1)
  })

  it('searches and filters payment requests then opens the exact payment and its allocated evidence', async () => {
    page(); await screen.findByText('****5678')
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu thanh toán' }))
    await screen.findByRole('link', { name: 'BCUC5PAID' })
    const input = screen.getByLabelText('Tìm mã thanh toán hoặc tên trại')
    for (const value of ['B', 'BC', 'BCUC5']) fireEvent.change(input, { target: { value } })
    await waitFor(() => expect(listCalls('payments').at(-1)).toContain('q=BCUC5'))
    expect(listCalls('payments').filter((path) => path.includes('q=BCUC5'))).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Trạng thái thanh toán'), { target: { value: 'PAID' } })
    await waitFor(() => expect(listCalls('payments').at(-1)).toContain('state=PAID'))
    fireEvent.click(screen.getByRole('link', { name: 'BCUC5PAID' }))
    expect(await screen.findByRole('region', { name: 'Chi tiết thanh toán' })).toHaveTextContent('RC-UC5')
    expect(urls()).toContain('/api/platform/payments/502')
    fireEvent.click(screen.getByRole('link', { name: 'Xem chứng từ ngân hàng' }))
    expect(await screen.findByText('Stored reason TK-5')).toBeInTheDocument()
    expect(urls()).toContain('/api/platform/payments/evidence/742')
    expect(http.command).not.toHaveBeenCalled()
  })

  it('keeps filters on return from payment detail and fetches the list again', async () => {
    page(); await screen.findByText('****5678')
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu thanh toán' })); await screen.findByText('BCUC5PAID')
    fireEvent.change(screen.getByLabelText('Trạng thái thanh toán'), { target: { value: 'EXPIRED' } })
    await waitFor(() => expect(listCalls('payments').at(-1)).toContain('state=EXPIRED'))
    fireEvent.click(screen.getByRole('link', { name: 'BCUC5PAID' }))
    await screen.findByRole('region', { name: 'Chi tiết thanh toán' }); const count = listCalls('payments').length
    fireEvent.click(screen.getByRole('link', { name: 'Quay lại danh sách thanh toán' }))
    expect(await screen.findByLabelText('Trạng thái thanh toán')).toHaveValue('EXPIRED')
    await waitFor(() => expect(listCalls('payments').length).toBeGreaterThan(count))
  })

  it('supports exact evidence deep links even when the selected evidence is outside the current page', async () => {
    page('/nen-tang/thanh-toan?evidenceId=999')
    await screen.findByText('Stored reason TK-5')
    expect(urls()).toContain('/api/platform/payments/evidence/999')
    expect(urls()).not.toContain('/api/platform/payments/evidence/842')
  })

  it('shows unknown account checks and legacy times as missing, without inventing confirmation or a PM', async () => {
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation(async (path: string) => /\/evidence\/\d+$/.test(path)
      ? { ...detail(), summary: { ...row(), receivingAccountMatches: null }, firstReceivedAt: null, history: [] } : original(path))
    page(); await screen.findByText('Chưa có lịch sử xử lý.')
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument()
    expect(screen.queryByText('PM persisted')).not.toBeInTheDocument()
  })

  it('does not poll and supports manual refresh without replacing the old list during loading', async () => {
    page(); await screen.findByText('****5678'); await screen.findByText('Stored reason TK-5')
    const count = listCalls().length
    vi.useFakeTimers(); await act(async () => { vi.advanceTimersByTime(20000) }); vi.useRealTimers()
    expect(listCalls()).toHaveLength(count)
    let release!: (value: unknown) => void
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation((path: string) => new URL(path, 'http://test').pathname.endsWith('/evidence')
      ? new Promise((resolve) => { release = resolve }) : original(path))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(screen.getByRole('table', { name: 'Chứng từ ngân hàng' }).closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true'))
    await act(async () => { release(pageOf([row()])) })
    expect(listCalls().length).toBeGreaterThan(count)
  })

  it('rejects malformed backend data with retry and never falls back to the demo store', async () => {
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation((path: string) => path.includes('/evidence?') ? Promise.resolve({ items: 'invalid' }) : original(path))
    page(); expect(await screen.findByText(/Dữ liệu thanh toán.*không hợp lệ/)).toBeInTheDocument()
    expect(platformServiceDemoStore.listEvidence).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('does not show a previous evidence detail while another evidence loads', async () => {
    page(); await screen.findByText('Stored reason TK-5')
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation(async (path: string) => path.endsWith('/evidence/999') ? new Promise(() => {}) : original(path))
    // A second mount represents a notification/source link to another persisted evidence.
    cleanup(); page('/nen-tang/thanh-toan?evidenceId=999')
    await waitFor(() => expect(urls()).toContain('/api/platform/payments/evidence/999'))
    expect(screen.queryByText('Stored reason TK-5')).not.toBeInTheDocument()
  })

  it('labels persisted handling events and system reasons in Vietnamese without exposing internal names', async () => {
    const original = http.get.getMockImplementation()!
    const event = (id: number, action: string, reason: string) => ({ id, source: 'EVENT', action, reason, reference: null,
      result: null, pmId: null, pmName: null, at: '2026-10-28T01:02:04Z' })
    http.get.mockImplementation(async (path: string) => /\/evidence\/\d+$/.test(path) ? {
      ...detail(), summary: { ...row(), reviewReason: 'No matching payment request' }, history: [
        ...detail().history, event(2, 'EVIDENCE_RECEIVED', 'Saved bank reason'),
        event(3, 'EVIDENCE_AUTO_ACCEPTED', 'Automatically matched by exact payment reference and amount'),
      ] } : original(path))
    page()
    expect(await screen.findByText('Tiếp nhận chứng từ')).toBeInTheDocument()
    expect(screen.getByText('Tự động chấp nhận')).toBeInTheDocument()
    expect(screen.getByText('Tự động khớp đúng mã thanh toán và số tiền')).toBeInTheDocument()
    expect(screen.getByText('Không có yêu cầu thanh toán khớp mã')).toBeInTheDocument()
    // Reasons typed by a PM, or not produced by the system, are shown exactly as stored.
    expect(screen.getByText('Saved bank reason')).toBeInTheDocument()
    expect(screen.getByText('Stored reason TK-5')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/EVIDENCE_|MOCK_EVIDENCE|Automatically matched|No matching payment request/)
  })

  it('shows the confirmation source of a payment as a business label', async () => {
    page('/nen-tang/thanh-toan?paymentId=502&origin=payments')
    const region = await screen.findByRole('region', { name: 'Chi tiết thanh toán' })
    expect(region).toHaveTextContent('Tự động qua SePay')
    expect(region).not.toHaveTextContent('SEPAY')
  })

  it('keeps an explicit evidence link when a stored page beyond the last page is corrected', async () => {
    sessionStorage.setItem(`beefcare:platform-payments:${session.email}`, JSON.stringify({ tab: 'evidence',
      evidence: { status: 'ALL', bankFrom: '', bankTo: '', page: 3 }, payments: { q: '', state: '', page: 0 } }))
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname.endsWith('/evidence')) return url.searchParams.get('page') === '3' ? pageOf([], 3, 21) : pageOf([row(743)], 1, 21)
      return original(path)
    })
    page('/nen-tang/thanh-toan?evidenceId=999')
    await waitFor(() => expect(listCalls().at(-1)).toContain('page=1'))
    await screen.findByText('****5678')
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expect(screen.getByLabelText('Tham số URL')).toHaveTextContent('evidenceId=999')
    expect(urls()).toContain('/api/platform/payments/evidence/999')
    expect(urls()).not.toContain('/api/platform/payments/evidence/743')
  })

  it('keeps automatic selection from changing the route when switching tabs', async () => {
    page(); await screen.findByText('Stored reason TK-5')
    expect(screen.getByLabelText('Tham số URL')).not.toHaveTextContent('evidenceId=')
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu thanh toán' }))
    expect(await screen.findByRole('link', { name: 'BCUC5PAID' })).toBeInTheDocument()
    expect(screen.getByLabelText('Trạng thái thanh toán')).toBeInTheDocument()
  })
})
