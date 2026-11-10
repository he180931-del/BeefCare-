import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import PlanPriceRoutes from '../../../src/features/platform-service/pages/PlanPriceRoutes'
import { BackendError } from '../../../src/api/backendClient'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn() }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendTransport: http,
}))
const session: Session = { role: 'PM', fullName: 'PM UC7', email: 'pm-uc7@example.test', farmId: null, farmName: null, logout: async () => {} }
const row = (id = 701, extra: Record<string, unknown> = {}) => ({ id, revision: 0, price1y: 1234567, price2y: 2345678, price3y: 3456789,
  terms: 'Không tự gia hạn', effectiveAt: '2026-10-28T00:00:00Z', status: 'EFFECTIVE', publishedById: 7, publishedBy: 'PM công bố',
  publishedAt: '2026-10-27T01:02:03Z', withdrawnAt: null, withdrawnBy: null, withdrawReason: null, ...extra })
const pageOf = (extra: Record<string, unknown> = {}) => ({ items: [row(), row(702, { status: 'SCHEDULED', effectiveAt: '2099-01-01T00:00:00Z' })],
  total: 2, page: 0, size: 20, current: row(), asOf: '2026-10-28T01:00:00Z', nextEffectiveAt: '2099-01-01T00:00:00Z', ...extra })
function page() { return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/nen-tang/bang-gia']}><PlanPriceRoutes /></MemoryRouter></SessionContext.Provider>) }
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label, { selector: 'input,textarea' }), { target: { value } })
const calls = () => http.command.mock.calls.map(([path, body, options]) => ({ path, body, options }))
async function confirmPublish() { fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' })); fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận công bố' })) }
beforeEach(() => { sessionStorage.clear(); http.get.mockReset(); http.command.mockReset(); http.get.mockResolvedValue(pageOf()); http.command.mockResolvedValue(row(990)); })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('UC7 backend SCR-63', () => {
  it('rejects decimal points and malformed thousands instead of silently turning them into a different amount', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    for (const value of ['1500.5', '1.50', '1.500,5']) {
      change(/Giá 1 năm/, value); fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('số nguyên')
      expect(http.command).not.toHaveBeenCalled()
    }
  })
  it('reads exact prices and real publication metadata, uses server IDs and has no saved-draft action', async () => {
    page(); expect(await screen.findByText('Bảng giá hiện hành · v701')).toBeInTheDocument()
    expect(http.get.mock.calls[0][0]).toBe('/api/platform/plan-prices?page=0&size=20')
    const history = within(screen.getByRole('region', { name: 'Lịch sử công bố' }))
    expect(history.getAllByText(/1\.234\.567/).length).toBeGreaterThan(0)
    expect(history.getAllByText(/PM công bố/).length).toBeGreaterThan(0)
    expect(history.getAllByText(/27\/10\/2026 08:02:03/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Soạn bảng giá v703/)).not.toBeInTheDocument()
  })
  it('publishes all fields with server-timed applyNow and one intent key, then refreshes', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    change(/Giá 1 năm/, '1.500.000'); change(/điều khoản/i, '  ' + 'x'.repeat(500) + '  ')
    await confirmPublish()
    await screen.findByText(/Đã công bố bảng giá v990/)
    const [sent] = calls(); expect(sent.path).toBe('/api/platform/plan-prices'); expect(sent.options.method).toBe('POST'); expect(sent.options.key).toMatch(/\S{8,}/)
    expect(sent.body).toEqual({ price1y: 1500000, price2y: 2345678, price3y: 3456789, applyNow: true, effectiveAt: null, terms: 'x'.repeat(500) })
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(1))
  })
  it('validates prices and scheduled time before sending and converts VN datetime to an instant', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    change(/Giá 1 năm/, '999'); fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('1.000'); expect(http.command).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: /Giá 1 năm/ }).parentElement).toContainElement(screen.getByRole('alert'))
    change(/Giá 1 năm/, '1.000'); fireEvent.click(screen.getByRole('radio', { name: 'Lên lịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' })); expect(screen.getByRole('alert')).toHaveTextContent('thời điểm')
    change('Hiệu lực từ *', '2098-12-01T07:30'); fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('01/12/2098 07:30')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận công bố' }))
    await waitFor(() => expect(http.command).toHaveBeenCalledOnce())
    expect(calls()[0].body).toMatchObject({ applyNow: false, effectiveAt: '2098-12-01T00:30:00.000Z' })
  })
  it('keeps form data and reuses the key after a failed publish, creating a new key for changed intent', async () => {
    http.command.mockRejectedValue(new BackendError(500, {})); page(); await screen.findByText('Bảng giá hiện hành · v701')
    change(/Giá 1 năm/, '1.500.000'); await confirmPublish()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể công bố')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận công bố' })); await waitFor(() => expect(http.command).toHaveBeenCalledTimes(2))
    expect(calls()[1].options.key).toBe(calls()[0].options.key)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' })); expect(screen.getByRole('textbox', { name: /Giá 1 năm/ })).toHaveValue('1.500.000')
    change(/Giá 1 năm/, '1.600.000'); await confirmPublish(); await waitFor(() => expect(http.command).toHaveBeenCalledTimes(3))
    expect(calls()[2].options.key).not.toBe(calls()[0].options.key)
  })
  it('starts a new intent key for a separate identical publication after a success, e.g. re-publishing a withdrawn slot', async () => {
    http.command.mockResolvedValue(row(990, { status: 'SCHEDULED', effectiveAt: '2098-12-01T00:30:00Z' }))
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('radio', { name: 'Lên lịch' })); change('Hiệu lực từ *', '2098-12-01T07:30')
      await confirmPublish(); await screen.findByText(/Đã công bố bảng giá v990/)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
    expect(calls()[1].body).toEqual(calls()[0].body)
    expect(calls()[1].options.key).not.toBe(calls()[0].options.key)
  })
  it('labels the required application choice and confirms the normalized amounts that will be sent', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    const application = screen.getByRole('radiogroup', { name: 'Áp dụng' })
    expect(within(application).getAllByRole('radio')).toHaveLength(2); expect(screen.getByText('Áp dụng *')).toBeInTheDocument()
    change(/Giá 1 năm/, '1500000'); fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('1.500.000 đ / 2.345.678 đ / 3.456.789 đ')
  })
  it('shows the conflicting version and its time from MSG-FE19-15', async () => {
    http.command.mockRejectedValue(new BackendError(409, { code: 'MSG-FE19-15', params: { version: 702, time: '2099-01-01T00:00:00Z' } }))
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    fireEvent.click(screen.getByRole('radio', { name: 'Lên lịch' })); change('Hiệu lực từ *', '2099-01-01T07:00'); await confirmPublish()
    const alert = await screen.findByRole('alert'); expect(alert).toHaveTextContent('v702'); expect(alert).toHaveTextContent('01/01/2099 07:00')
  })
  it('reads legacy positive whole prices outside the new input range but still rejects impossible prices', async () => {
    http.get.mockResolvedValue(pageOf({ current: row(701, { price1y: 500 }), items: [row(701, { price1y: 500 }), row(600, { status: 'SUPERSEDED', price3y: 2000000000 })] }))
    page(); expect(await screen.findByText('Bảng giá hiện hành · v701')).toBeInTheDocument()
    expect(screen.getAllByText(/2\.000\.000\.000/).length).toBeGreaterThan(0); expect(screen.getByRole('textbox', { name: /Giá 1 năm/ })).toHaveValue('500')
    fireEvent.click(screen.getByRole('button', { name: 'Công bố phiên bản' })); expect(await screen.findByRole('alert')).toHaveTextContent('1.000')
    expect(http.command).not.toHaveBeenCalled(); cleanup()
    for (const bad of [0, -1, 1500.5]) {
      http.get.mockResolvedValue(pageOf({ items: [row(600, { status: 'SUPERSEDED', price2y: bad })] }))
      page(); expect(await screen.findByRole('alert')).toHaveTextContent('không hợp lệ'); cleanup()
    }
  })
  it('counts withdrawal reason characters like the server and explains a server reason rejection', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701'); fireEvent.click(screen.getByRole('button', { name: 'Rút v702' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Rút lại bảng giá v702' }))
    change('Lý do *', '😀😀😀'); fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' }))
    expect(dialog.getByRole('alert')).toHaveTextContent('5'); expect(http.command).not.toHaveBeenCalled()
    http.command.mockRejectedValue(new BackendError(400, { code: 'MSG-COM-10', params: { field: 'reason' } }))
    change('Lý do *', 'Sai bảng giá'); fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' }))
    await waitFor(() => expect(dialog.getByRole('alert')).toHaveTextContent('ít nhất 5 ký tự')); expect(dialog.getByRole('alert')).toHaveTextContent('1.000')
  })
  it('withdraws a selected future version with the observed revision and required bounded reason', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701'); fireEvent.click(screen.getByRole('button', { name: 'Rút v702' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Rút lại bảng giá v702' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' })); expect(await dialog.findByRole('alert')).toHaveTextContent('lý do')
    change('Lý do *', 'a b c d'); fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' })); expect(dialog.getByRole('alert')).toHaveTextContent('5')
    change('Lý do *', 'x'.repeat(1001)); fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' })); expect(dialog.getByRole('alert')).toHaveTextContent('1.000')
    change('Lý do *', '  Sai bảng giá  '); fireEvent.click(dialog.getByRole('button', { name: 'Rút lại phiên bản' }))
    await waitFor(() => expect(http.command).toHaveBeenCalledOnce()); expect(calls()[0]).toMatchObject({ path: '/api/platform/plan-prices/702/withdraw', body: { reason: 'Sai bảng giá', expectedVersion: 0 } })
  })
  it('reloads stale withdrawal data and preserves the explanation instead of silently retrying', async () => {
    http.command.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' })); page(); await screen.findByText('Bảng giá hiện hành · v701')
    fireEvent.click(screen.getByRole('button', { name: 'Rút v702' })); change('Lý do *', 'Sai bảng giá')
    fireEvent.click(screen.getByRole('button', { name: 'Rút lại phiên bản' })); expect(await screen.findByRole('alert')).toHaveTextContent('thay đổi')
    expect(screen.getByLabelText('Lý do *')).toHaveValue('Sai bảng giá'); await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(1)); expect(http.command).toHaveBeenCalledOnce()
  })
  it('keeps pagination in the session and current price independent of history pages', async () => {
    http.get.mockImplementation(async (path: string) => pageOf({ page: new URL(path, 'http://t').searchParams.get('page') === '1' ? 1 : 0, total: 21, items: [row()] }))
    const mounted = page(); await screen.findByText('Bảng giá hiện hành · v701'); fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/api/platform/plan-prices?page=1&size=20'))
    mounted.unmount(); page(); await screen.findByText('Bảng giá hiện hành · v701'); expect(http.get).toHaveBeenLastCalledWith('/api/platform/plan-prices?page=1&size=20')
  })
  it('shows backend read failures and malformed responses without demo fallback', async () => {
    http.get.mockResolvedValueOnce([{ id: 1 }]); page(); expect(await screen.findByRole('alert')).toHaveTextContent('không hợp lệ')
    http.get.mockResolvedValue(pageOf()); fireEvent.click(screen.getByRole('button', { name: /Thử lại/ })); await screen.findByText('Bảng giá hiện hành · v701')
  })
  it('confirms before discarding edited input and retains it when cancellation is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); page(); await screen.findByText('Bảng giá hiện hành · v701')
    change(/Giá 1 năm/, '1.500.000'); fireEvent.click(screen.getByRole('button', { name: 'Hủy chỉnh sửa' }))
    expect(confirm).toHaveBeenCalled(); expect(screen.getByRole('textbox', { name: /Giá 1 năm/ })).toHaveValue('1.500.000')
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Hủy chỉnh sửa' })); expect(screen.getByRole('textbox', { name: /Giá 1 năm/ })).toHaveValue('1.234.567')
  })
  it('refreshes once at the effective boundary using server time and never polls on an idle page', async () => {
    page(); await screen.findByText('Bảng giá hiện hành · v701')
    vi.useFakeTimers(); http.get.mockResolvedValue(pageOf({ asOf: '2026-10-28T01:00:00Z', nextEffectiveAt: '2026-10-28T01:00:10Z' }))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' })); await act(async () => {})
    const before = http.get.mock.calls.length; await act(async () => { vi.advanceTimersByTime(9000) }); expect(http.get).toHaveBeenCalledTimes(before)
    http.get.mockResolvedValue(pageOf({ current: row(702), nextEffectiveAt: null, asOf: '2026-10-28T01:00:10Z' }))
    await act(async () => { vi.advanceTimersByTime(1100) }); expect(http.get).toHaveBeenCalledTimes(before + 1)
    await act(async () => { vi.advanceTimersByTime(30000) }); expect(http.get).toHaveBeenCalledTimes(before + 1)
  })
})
