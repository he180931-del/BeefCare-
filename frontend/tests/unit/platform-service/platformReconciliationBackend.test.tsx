import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import PaymentReconciliationRoutes from '../../../src/features/platform-service/pages/PaymentReconciliationRoutes'
import { BackendError } from '../../../src/api/backendClient'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))
const session: Session = { role: 'PM', fullName: 'PM UC6', email: 'uc6@example.test', farmId: null, farmName: null, logout: async () => {} }
type Row = Record<string, unknown>
const row = (id = 742, extra: Row = {}): Row => ({ id, provider: 'SEPAY', environment: 'TEST', accountNamespace: 'UC6-NS',
  maskedTransactionId: '****5678', amount: 1200000, direction: 'IN', content: 'Chuyen khoan BCTYPO', bankPaidAt: '2026-10-28T01:02:03Z',
  reviewStatus: 'TO_REVIEW', matchResult: 'NO_REQUEST', reviewReason: null, receivingAccountMatches: true, paymentId: null, paymentCode: null, version: 3, ...extra })
let detailOverride: (id: number) => Row = () => ({})
const detail = (id = 742): Row => {
  const extra = detailOverride(id)
  return { summary: row(id, (extra.summary as Row) ?? {}), transactionId: '12345678', receivingAccount: 'UC6-ACCOUNT', bank: 'TESTBANK',
    referenceCode: 'BANK-REF', quoteRef: 'BCTYPO', firstReceivedAt: '2026-10-28T01:02:04Z', returnReference: null, returnDate: null, returnResult: null,
    history: [], ...extra, ...(extra.summary ? { summary: row(id, extra.summary as Row) } : {}) }
}
const candidate = (paymentId = 601, quoteRef = 'BCCANDIDATE') => ({ paymentId, quoteRef, farmId: 42, farmName: 'Trại ứng viên', amount: 1200000,
  termYears: 1, expiresAt: '2026-10-29T00:00:00Z', accountNamespace: 'UC6-NS' })
const pageOf = (items: unknown[]) => ({ items, total: items.length, page: 0, size: 20 })
const done = (extra: Row = {}) => ({ id: 742, version: 4, reviewStatus: 'HOLD', lockedForReturn: false, paymentId: null, ...extra })
const calls = (suffix: string) => http.get.mock.calls.map(([p]) => String(p)).filter((p) => new URL(p, 'http://t').pathname.endsWith(suffix))
const commands = () => http.command.mock.calls.map(([path, body, options]) => ({ path: String(path), body: body as Row, options: options as Row }))
function CurrentSearch() { return <output aria-label="Tham số URL">{useLocation().search}</output> }
function page(path = '/nen-tang/thanh-toan') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/nen-tang/thanh-toan" element={<PaymentReconciliationRoutes />} /></Routes><CurrentSearch />
  </MemoryRouter></SessionContext.Provider>)
}
const panel = async () => within(await screen.findByRole('region', { name: 'Xử lý chứng từ' }))
const reason = (value: string) => fireEvent.change(screen.getByLabelText('Lý do và tham chiếu chứng từ'), { target: { value } })

beforeEach(() => {
  http.get.mockReset(); http.command.mockReset(); sessionStorage.clear(); detailOverride = () => ({})
  http.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://t')
    if (url.pathname.endsWith('/summary')) return { pendingRequests: 1, evidenceToReview: 2, hold: 0, lockedForReturn: 0 }
    if (url.pathname.endsWith('/candidates')) return [candidate()]
    if (url.pathname.endsWith('/evidence')) return pageOf([row()])
    if (/\/evidence\/\d+$/.test(url.pathname)) return detail(Number(url.pathname.split('/').at(-1)))
    if (url.pathname.endsWith('/lookup')) return { items: [], limit: 200 }
    return pageOf([])
  })
  http.command.mockResolvedValue(done())
})
afterEach(() => cleanup())

describe('UC-FE19-06 reconciliation on SCR-62 (D19)', () => {
  it('requires a decision, a candidate for a mistyped code and a reason before sending one keyed ACCEPT, then reloads', async () => {
    page(); const p = await panel()
    expect(p.getByRole('radio', { name: /BCCANDIDATE/ })).not.toBeChecked()
    expect(p.getByRole('link', { name: 'Xem yêu cầu BCCANDIDATE' })).toHaveAttribute('href', '/nen-tang/thanh-toan?paymentId=601&origin=payments')
    expect(screen.queryByRole('table', { name: 'Yêu cầu ứng viên' })).not.toBeInTheDocument()
    fireEvent.click(p.getByRole('button', { name: 'Lưu quyết định' }))
    expect(await p.findByRole('alert')).toHaveTextContent('Vui lòng chọn quyết định.')
    fireEvent.click(p.getByRole('radio', { name: 'Chấp nhận' }))
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(p.getByRole('alert')).toHaveTextContent('Không thể chấp nhận chứng từ này: mã chuyển khoản không chính xác và chưa chọn yêu cầu ứng viên.')
    fireEvent.click(p.getByRole('radio', { name: /BCCANDIDATE/ }))
    expect(p.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(p.getByRole('alert')).toHaveTextContent('Vui lòng nhập lý do và tham chiếu chứng từ.')
    reason('x'.repeat(1001))
    expect(p.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(p.getByRole('alert')).toHaveTextContent('tối đa 1.000 ký tự')
    expect(http.command).not.toHaveBeenCalled()
    const before = { detail: calls('/evidence/742').length, list: calls('/evidence').length, tiles: calls('/summary').length }
    http.command.mockResolvedValueOnce(done({ reviewStatus: 'ACCEPTED', paymentId: 601 }))
    reason('  Khách gõ sai mã; sao kê TK-77  ')
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã lưu quyết định Chấp nhận cho giao dịch 12345678.')
    const [sent] = commands()
    expect(sent.path).toBe('/api/platform/payments/evidence/742/review')
    expect(sent.body).toEqual({ decision: 'ACCEPT', paymentId: 601, reason: 'Khách gõ sai mã; sao kê TK-77', version: 3 })
    expect(sent.options.method).toBe('POST')
    expect(String(sent.options.key)).toMatch(/\S{8,}/)
    await waitFor(() => expect(calls('/evidence/742').length).toBeGreaterThan(before.detail))
    expect(calls('/evidence').length).toBeGreaterThan(before.list)
    expect(calls('/summary').length).toBeGreaterThan(before.tiles)
  })

  it('preselects the exact-code request and keeps one key per unchanged submission', async () => {
    detailOverride = () => ({ quoteRef: 'BCCANDIDATE' })
    page(); const p = await panel()
    fireEvent.click(p.getByRole('radio', { name: 'Chấp nhận' }))
    expect(p.getByRole('radio', { name: /BCCANDIDATE/ })).toBeChecked()
    http.command.mockRejectedValueOnce(new BackendError(500, {})).mockRejectedValueOnce(new BackendError(500, {}))
    reason('Đúng mã')
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await p.findByRole('alert')).toHaveTextContent('Không thể lưu dữ liệu. Vui lòng thử lại.')
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    await waitFor(() => expect(http.command).toHaveBeenCalledTimes(2))
    reason('Đúng mã, đã đối chiếu')
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    await waitFor(() => expect(http.command).toHaveBeenCalledTimes(3))
    const [first, retry, changed] = commands()
    expect(first.body.paymentId).toBe(601)
    expect(retry.options.key).toBe(first.options.key)
    expect(changed.options.key).not.toBe(first.options.key)
  })

  it('shows the rule blocking acceptance and reloads a record that changed meanwhile', async () => {
    page(); const p = await panel()
    fireEvent.click(p.getByRole('radio', { name: 'Chấp nhận' }))
    fireEvent.click(p.getByRole('radio', { name: /BCCANDIDATE/ }))
    reason('Thử chấp nhận')
    http.command.mockRejectedValueOnce(new BackendError(409, { code: 'MSG-FE19-11', params: { reason: 'AMOUNT_MISMATCH' } }))
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await p.findByRole('alert')).toHaveTextContent('Không thể chấp nhận chứng từ này: số tiền không khớp số tiền yêu cầu.')
    const loads = calls('/evidence/742').length
    detailOverride = () => ({ summary: { version: 4 } })
    http.command.mockRejectedValueOnce(new BackendError(409, { code: 'MSG-COM-05', params: { field: 'version' } }))
    fireEvent.click(p.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await screen.findByText(/Chứng từ vừa thay đổi \(ví dụ SePay vừa xác nhận\)/)).toBeInTheDocument()
    await waitFor(() => expect(calls('/evidence/742').length).toBeGreaterThan(loads))
    const reloaded = await panel()
    await waitFor(() => expect(reloaded.getByRole('radio', { name: 'Chấp nhận' })).toBeChecked())
    expect(reloaded.getByRole('radio', { name: /BCCANDIDATE/ })).toBeChecked()
    expect(screen.getByLabelText('Lý do và tham chiếu chứng từ')).toHaveValue('Thử chấp nhận')
    http.command.mockResolvedValueOnce(done({ reviewStatus: 'ACCEPTED', paymentId: 601 }))
    fireEvent.click(reloaded.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    await waitFor(() => expect(http.command).toHaveBeenCalledTimes(3))
    expect(commands()[2].body.version).toBe(4)
  })

  it('saves HOLD and REJECT with a reason only and no candidate', async () => {
    page(); const p = await panel()
    fireEvent.click(p.getByRole('radio', { name: /BCCANDIDATE/ }))
    fireEvent.click(p.getByRole('radio', { name: 'Tạm giữ' }))
    reason('Chờ khách gửi sao kê')
    fireEvent.click(p.getByRole('button', { name: 'Lưu tạm giữ' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã lưu quyết định Tạm giữ cho giao dịch 12345678.')
    expect(commands()[0].body).toEqual({ decision: 'HOLD', paymentId: null, reason: 'Chờ khách gửi sao kê', version: 3 })
  })

  it('locks for return with a reason, then offers only record or unlock, and finally shows the recorded return', async () => {
    page(); let p = await panel()
    fireEvent.click(p.getByRole('button', { name: 'Khóa hoàn trả' }))
    fireEvent.click(p.getByRole('button', { name: 'Xác nhận khóa' }))
    expect(p.getByRole('alert')).toHaveTextContent('Vui lòng nhập lý do khóa hoàn trả.')
    fireEvent.change(p.getByLabelText('Lý do khóa hoàn trả'), { target: { value: 'Khách chuyển nhầm' } })
    http.command.mockResolvedValueOnce(done({ reviewStatus: 'LOCKED_FOR_RETURN', lockedForReturn: true }))
    detailOverride = () => ({ summary: { reviewStatus: 'LOCKED', version: 4 } })
    fireEvent.click(p.getByRole('button', { name: 'Xác nhận khóa' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Giao dịch 12345678 đã khóa để hoàn trả và không thể dùng cho thanh toán nào.')
    expect(commands()[0]).toMatchObject({ path: '/api/platform/payments/evidence/742/lock-return', body: { reason: 'Khách chuyển nhầm', version: 3 } })
    p = await panel()
    await p.findByRole('button', { name: 'Ghi hoàn trả' })
    expect(p.queryByRole('radio', { name: 'Chấp nhận' })).not.toBeInTheDocument()
    expect(p.getByRole('button', { name: 'Mở khóa' })).toBeInTheDocument()
    fireEvent.click(p.getByRole('button', { name: 'Ghi hoàn trả' }))
    expect(p.getByRole('alert')).toHaveTextContent('Vui lòng nhập mã giao dịch chiều ra.')
    fireEvent.change(p.getByLabelText('Mã giao dịch chiều ra'), { target: { value: 'FT-OUT-9' } })
    fireEvent.change(p.getByLabelText('Ngày hoàn trả'), { target: { value: '2999-01-01' } })
    fireEvent.change(p.getByLabelText('Kết quả hoàn trả'), { target: { value: 'Đã hoàn đủ' } })
    fireEvent.click(p.getByRole('button', { name: 'Ghi hoàn trả' }))
    expect(p.getByRole('alert')).toHaveTextContent('Ngày hoàn trả không được ở tương lai.')
    expect(http.command).toHaveBeenCalledTimes(1)
    fireEvent.change(p.getByLabelText('Ngày hoàn trả'), { target: { value: '2026-10-28' } })
    http.command.mockResolvedValueOnce(done({ reviewStatus: 'LOCKED_FOR_RETURN', lockedForReturn: true, version: 5 }))
    detailOverride = () => ({ summary: { reviewStatus: 'LOCKED', version: 5 }, returnReference: 'FT-OUT-9', returnDate: '2026-10-28', returnResult: 'Đã hoàn đủ',
      history: [{ id: 9, source: 'REVIEW', action: 'RETURN_VERIFIED', reason: null, reference: 'FT-OUT-9', result: 'Đã hoàn đủ', returnDate: '2026-10-28',
        pmId: 7, pmName: 'PM UC6', at: '2026-10-28T02:00:00Z' }] })
    fireEvent.click(p.getByRole('button', { name: 'Ghi hoàn trả' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã ghi hoàn trả cho giao dịch 12345678.')
    expect(commands()[1]).toMatchObject({ path: '/api/platform/payments/evidence/742/record-return',
      body: { reference: 'FT-OUT-9', returnDate: '2026-10-28', result: 'Đã hoàn đủ', version: 4 } })
    p = await panel()
    expect(await p.findByText('Đã ghi hoàn trả: không thể mở khóa hay dùng giao dịch này cho thanh toán.')).toBeInTheDocument()
    expect(p.queryByRole('button', { name: 'Mở khóa' })).not.toBeInTheDocument()
    const history = screen.getByRole('table', { name: 'Lịch sử xử lý' })
    expect(within(history).getByText('Xác minh hoàn trả')).toBeInTheDocument()
    expect(within(history).getByText(/Ngày hoàn trả: 28\/10\/2026/)).toBeInTheDocument()
    expect(within(history).getByRole('cell', { name: /^Tham chiếu: FT-OUT-9/ })).toBeInTheDocument()
  })

  it('unlocks a locked evidence with a reason', async () => {
    detailOverride = () => ({ summary: { reviewStatus: 'LOCKED' } })
    page(); const p = await panel()
    fireEvent.change(await p.findByLabelText('Lý do mở khóa'), { target: { value: 'Khách không cần trả' } })
    http.command.mockResolvedValueOnce(done({ reviewStatus: 'UNMATCHED' }))
    fireEvent.click(p.getByRole('button', { name: 'Mở khóa' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã mở khóa giao dịch 12345678.')
    expect(commands()[0]).toMatchObject({ path: '/api/platform/payments/evidence/742/unlock-return', body: { reason: 'Khách không cần trả', version: 3 } })
  })

  it('offers no acceptance or lock for allocated evidence and no acceptance or lock for outgoing transfers', async () => {
    detailOverride = (id) => id === 742 ? { summary: { reviewStatus: 'ACCEPTED', paymentId: 601, paymentCode: 'BCCANDIDATE', matchResult: 'PAID_PM' } } : {}
    page(); let p = await panel()
    expect(await p.findByText('Chứng từ đã được phân bổ cho thanh toán; không thể đổi quyết định.')).toBeInTheDocument()
    expect(p.queryByRole('radio')).not.toBeInTheDocument()
    expect(p.queryByRole('button', { name: 'Khóa hoàn trả' })).not.toBeInTheDocument()
    cleanup()
    detailOverride = () => ({ summary: { direction: 'OUT', matchResult: 'OUTGOING' } })
    page(); p = await panel()
    expect(await p.findByRole('radio', { name: 'Tạm giữ' })).toBeInTheDocument()
    expect(p.queryByRole('radio', { name: 'Chấp nhận' })).not.toBeInTheDocument()
    expect(p.queryByRole('button', { name: 'Khóa hoàn trả' })).not.toBeInTheDocument()
  })

  it('looks up a SePay transaction by ID, stores it once and opens the evidence', async () => {
    page(); await panel()
    const lookup = screen.getByRole('region', { name: 'Tra cứu giao dịch SePay' })
    for (const label of ['Mã giao dịch SePay', 'Từ ngày', 'Đến ngày']) expect(within(lookup).getByText(label, { selector: 'label' })).toBeVisible()
    fireEvent.change(within(lookup).getByLabelText('Mã giao dịch SePay'), { target: { value: 'abc' } })
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo mã' }))
    expect(within(lookup).getByRole('alert')).toHaveTextContent('Mã giao dịch phải là số nguyên dương.')
    http.command.mockResolvedValueOnce({ success: true, duplicate: false, evidenceId: 999, reviewStatus: 'UNMATCHED', paymentId: null })
    fireEvent.change(within(lookup).getByLabelText('Mã giao dịch SePay'), { target: { value: '9001' } })
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo mã' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã lưu giao dịch 9001 thành chứng từ.')
    expect(commands()[0]).toMatchObject({ path: '/api/platform/payments/lookup/9001', options: { method: 'POST' } })
    await waitFor(() => expect(screen.getByLabelText('Tham số URL')).toHaveTextContent('evidenceId=999'))
    await waitFor(() => expect(calls('/evidence/999').length).toBeGreaterThan(0))
    http.command.mockRejectedValueOnce(new BackendError(503, { title: 'Service Unavailable' }))
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo mã' }))
    expect(await within(lookup).findByRole('alert')).toHaveTextContent('Chưa cấu hình tra cứu SePay ở môi trường này.')
  })

  it('lists SePay transactions by period after validating the range without HTTP, then saves a row', async () => {
    page(); await panel()
    const lookup = screen.getByRole('region', { name: 'Tra cứu giao dịch SePay' })
    const from = within(lookup).getByLabelText('Tra cứu từ ngày'); const to = within(lookup).getByLabelText('Tra cứu đến ngày')
    fireEvent.change(from, { target: { value: '2026-10-31' } }); fireEvent.change(to, { target: { value: '2026-10-01' } })
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo khoảng ngày' }))
    expect(within(lookup).getByRole('alert')).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc.')
    fireEvent.change(from, { target: { value: '2026-10-01' } }); fireEvent.change(to, { target: { value: '2026-11-01' } })
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo khoảng ngày' }))
    expect(within(lookup).getByRole('alert')).toHaveTextContent('Khoảng tra cứu tối đa 31 ngày.')
    expect(calls('/lookup')).toHaveLength(0)
    const rows = [
      { transactionId: 9101, bankPaidAt: '2026-10-28T01:00:00Z', amount: 1200000, direction: 'IN', content: 'Đã lưu', referenceCode: 'R1', evidenceId: 742 },
      { transactionId: 9102, bankPaidAt: '2026-10-28T02:00:00Z', amount: 300000, direction: 'OUT', content: null, referenceCode: null, evidenceId: null },
    ]
    http.get.mockImplementation(async (path: string) => new URL(path, 'http://t').pathname.endsWith('/lookup') ? { items: rows, limit: 200 }
      : /\/evidence\/\d+$/.test(new URL(path, 'http://t').pathname) ? detail() : new URL(path, 'http://t').pathname.endsWith('/candidates') ? [] : pageOf([row()]))
    fireEvent.change(to, { target: { value: '2026-10-31' } })
    fireEvent.click(within(lookup).getByRole('button', { name: 'Tra cứu theo khoảng ngày' }))
    const table = await within(lookup).findByRole('table', { name: 'Giao dịch SePay' })
    expect(calls('/lookup')[0]).toContain('from=2026-10-01'); expect(calls('/lookup')[0]).toContain('to=2026-10-31')
    expect(within(table).getByRole('button', { name: 'Mở chứng từ 9101' })).toBeInTheDocument()
    http.command.mockResolvedValueOnce({ success: true, duplicate: false, evidenceId: 1001, reviewStatus: 'UNMATCHED', paymentId: null })
    fireEvent.click(within(table).getByRole('button', { name: 'Lưu thành chứng từ 9102' }))
    expect(await screen.findByRole('status', { name: 'Kết quả thao tác' })).toHaveTextContent('Đã lưu giao dịch 9102 thành chứng từ.')
    expect(commands()[0].path).toBe('/api/platform/payments/lookup/9102')
    await waitFor(() => expect(calls('/lookup')).toHaveLength(2))
  })
})
