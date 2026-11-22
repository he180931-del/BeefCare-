import type { ReactNode } from 'react'
import { act, render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import type { EntryLineVoidCheck, HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ get: vi.fn(), check: vi.fn(), correct: vi.fn(), voidLine: vi.fn(), breeds: vi.fn(), sellers: vi.fn(), role: 'OWNER', backend: true }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: state.role }) }))
vi.mock('../../../src/features/herd-entry/api/index', async original => ({
  ...(await original<typeof import('../../../src/features/herd-entry/api/index')>()),
  get entryLineCorrectionEnabled() { return state.backend }, herdEntryApi: { get: state.get },
  entryVoidCheck: state.check, correctEntryLine: state.correct, voidEntryLine: state.voidLine, listEntryBreeds: state.breeds, listEntrySellers: state.sellers,
}))
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'

const voucher: HerdEntry = { id: 'PN-1', version: 3, entryType: 'PURCHASE', pricingBasis: 'PER_KG', type: 'Mua ngoài', sellerId: 7, status: 'Đã nhập', date: '2026-10-20', count: 3,
  detail: { by: 'Người ghi thử', cows: [1, 2, 3].map(index => ({ entryId: 90 + index, lineVersion: 0, lineStatus: 'VALID', cattleId: 500 + index, code: `BC-00${index}`, weight: 250, weightBasis: 'MEASURED', unitPrice: 1000, breedId: 21, breed: 'Lai Sind · Cái', sexCode: 'FEMALE', birthDate: '2023-01-01', birthDateAccuracy: 'EXACT' })) } }
beforeEach(() => {
  state.role = 'OWNER'; state.backend = true
  state.get.mockReset().mockResolvedValue(structuredClone(voucher))
  state.check.mockReset().mockImplementation(async entryId => ({ entryId, cattleCode: `BC-00${entryId - 90}`, eventsAfterEntry: [], canVoid: true, reason: null }))
  state.correct.mockReset().mockResolvedValue({ notice: { message: 'Sửa thành công từ server' }, overpaidNotice: null })
  state.voidLine.mockReset().mockResolvedValue({ notice: { message: 'Hủy thành công từ server' }, overpaidNotice: null })
  state.breeds.mockReset().mockResolvedValue([{ id: 21, name: 'Lai Sind', available: true }])
  state.sellers.mockReset().mockResolvedValue([{ id: '7', name: 'Nguồn thử' }])
})
function Address() { return <output data-testid="address">{useLocation().search}</output> }
function renderPage(query = '') { return render(<MemoryRouter initialEntries={[`/herd-entry/PN-1${query}`]}><Routes><Route path="/herd-entry/:id" element={<><ImportDetail /><Address /></>} /></Routes></MemoryRouter>) }
async function openLine() {
  const user = userEvent.setup(); renderPage()
  const row = await screen.findByRole('row', { name: /BC-001/ })
  await user.click(within(row).getByRole('button', { name: 'Sửa / Hủy' }))
  await waitFor(() => expect(state.check).toHaveBeenCalledWith(91))
  await waitFor(() => expect(screen.queryByText('Đang kiểm tra…')).not.toBeInTheDocument())
  return user
}
async function weightAndReason(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Cân nhập mới (kg)'), '260')
  await user.selectOptions(screen.getByLabelText('Cơ sở cân mới'), 'MEASURED')
  await user.type(screen.getByLabelText('Lý do'), 'Sửa cân nhập')
}

it('requires a change and an explicit weight basis, submits only changed fields with opened versions, then refetches server notices', async () => {
  const user = await openLine()
  expect(screen.getByTestId('address')).toHaveTextContent('m=line&entry=91')
  await user.type(screen.getByLabelText('Lý do'), 'Sửa cân nhập')
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await user.type(screen.getByLabelText('Cân nhập mới (kg)'), '260')
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('Cơ sở cân mới'), 'MEASURED')
  state.correct.mockResolvedValue({ notice: { message: 'Sửa thành công từ server' }, overpaidNotice: { message: 'Đã trả vượt tổng mới đúng nguyên văn: 123 đ.' } })
  state.get.mockResolvedValue({ ...voucher, version: 4, detail: { ...voucher.detail, cows: voucher.detail!.cows!.map(line => line.entryId === 91 ? { ...line, weight: 260 } : line) } })
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(state.correct).toHaveBeenCalledWith(91, { reason: 'Sửa cân nhập', expectedVersion: 0, voucherVersion: 3, changes: { entryWeightKg: 260, weightBasis: 'MEASURED' } })
  await screen.findByText('Sửa thành công từ server')
  expect(screen.getByText('Đã trả vượt tổng mới đúng nguyên văn: 123 đ.')).toBeInTheDocument()
  await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2))
  expect(within(screen.getByRole('row', { name: /BC-001/ })).getByText('260 kg')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens the same line from its URL and keeps farm-born source fields read-only', async () => {
  state.get.mockResolvedValue({ ...voucher, entryType: 'FARM_BORN', type: 'Bê sinh tại trại' })
  renderPage('?m=line&entry=91')
  await screen.findByLabelText('Cân nhập mới (kg)')
  expect(screen.queryByLabelText('Giống mới')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Giới tính mới')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Ngày sinh mới')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Đơn giá mới')).not.toBeInTheDocument()
  expect(screen.getAllByText('Lấy từ lần đẻ').length).toBeGreaterThan(0)
  expect(state.breeds).not.toHaveBeenCalled(); expect(state.sellers).not.toHaveBeenCalled()
})

it('preserves the birth date when correcting only its accuracy', async () => {
  const user = await openLine()
  await user.selectOptions(screen.getByLabelText('Độ chính xác ngày sinh mới'), 'ESTIMATED')
  await user.type(screen.getByLabelText('Lý do'), 'Sửa độ chính xác')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(state.correct).toHaveBeenCalledWith(91, { reason: 'Sửa độ chính xác', expectedVersion: 0, voucherVersion: 3, changes: { birthDate: '2023-01-01', birthDateAccuracy: 'ESTIMATED' } })
})

it('shows later events without offering line voiding', async () => {
  state.check.mockResolvedValue({ canVoid: false, eventsAfterEntry: ['Cân ngày 01/11/2026'], reason: 'HAS_EVENTS', cattleCode: 'BC-001' })
  await openLine()
  expect(screen.queryByRole('radio', { name: 'Hủy bản ghi' })).not.toBeInTheDocument()
  expect(screen.getByText(/BC-001 đã có sự kiện: Cân ngày 01\/11\/2026/)).toBeInTheDocument()
})

it('directs the last VALID line to the existing whole-voucher popup, excluding VOID lines from eligibility', async () => {
  state.get.mockResolvedValue({ ...voucher, count: 1, detail: { cows: voucher.detail!.cows!.map((line, index) => index ? { ...line, lineStatus: 'VOID' } : line) } })
  const user = await openLine()
  expect(screen.queryByRole('radio', { name: 'Hủy bản ghi' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Hủy cả phiếu' }))
  expect(await screen.findByRole('button', { name: 'Hủy phiếu nhập' })).toBeInTheDocument()
  expect(screen.getByTestId('address')).toHaveTextContent('m=cancel')
})

it('confirms a line void inside the popup, preserves the reason on Back and leaves the VOID row visible after refresh', async () => {
  const user = await openLine()
  await user.click(screen.getByRole('radio', { name: 'Hủy bản ghi' }))
  await user.type(screen.getByLabelText('Lý do'), 'Ghi nhầm con')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(state.voidLine).not.toHaveBeenCalled()
  expect(screen.getByText(/Hủy bản ghi nhập của BC-001 trên PN-1/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Quay lại' }))
  expect(screen.getByLabelText('Lý do')).toHaveValue('Ghi nhầm con')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  state.get.mockResolvedValue({ ...voucher, count: 2, detail: { cows: voucher.detail!.cows!.map(line => line.entryId === 91 ? { ...line, lineStatus: 'VOID' } : line) } })
  await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
  expect(state.voidLine).toHaveBeenCalledWith(91, { reason: 'Ghi nhầm con', expectedVersion: 0 })
  await screen.findByText('Hủy thành công từ server')
  const row = screen.getByRole('row', { name: /BC-001/ })
  expect(within(row).getByText('Đã hủy')).toBeInTheDocument()
  expect(within(row).queryByRole('button', { name: 'Sửa / Hủy' })).not.toBeInTheDocument()
})

it('keeps entered values on FE06-07 and explains the event date', async () => {
  state.correct.mockRejectedValue(new BackendError(422, { code: 'MSG-FE06-07', params: { reason: 'EVENT_BEFORE_ENTRY_DATE', date: '2026-11-01', cattle_code: 'BC-001' } }))
  const user = await openLine()
  fireEvent.change(screen.getByLabelText('Ngày nhập mới'), { target: { value: '2026-11-02' } })
  await user.type(screen.getByLabelText('Lý do'), 'Sửa ngày')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await screen.findByText(/Không thể sửa:.*01\/11\/2026.*BC-001/)
  expect(screen.getByLabelText('Ngày nhập mới')).toHaveValue('2026-11-02')
  expect(screen.getByLabelText('Lý do')).toHaveValue('Sửa ngày')
  expect(state.get).toHaveBeenCalledTimes(1)
})

it.each([
  ['MSG-FE06-09', { cattle_code: 'BC-001', events: 'Cân ngày 01/11' }, 'Không thể hủy vì BC-001'],
  ['MSG-FE06-20', { action: 'VOID_VOUCHER' }, 'Đây là con cuối cùng'],
] as const)('keeps the popup and values after server eligibility changed: %s', async (code, params, text) => {
  state.voidLine.mockRejectedValue(new BackendError(422, { code, params }))
  const user = await openLine()
  await user.click(screen.getByRole('radio', { name: 'Hủy bản ghi' }))
  await user.type(screen.getByLabelText('Lý do'), 'Lý do đang nhập')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
  await screen.findByText(new RegExp(text))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Lý do')).toHaveValue('Lý do đang nhập')
})

it('keeps the opened snapshot and inputs on conflict/Stay and only reloads explicitly', async () => {
  state.correct.mockImplementation(async () => { throw new BackendError(409, { code: 'MSG-COM-05' }) })
  const user = await openLine(); await weightAndReason(user)
  state.get.mockResolvedValue({ ...voucher, version: 14 })
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await user.click(await screen.findByRole('button', { name: 'Ở lại' }))
  expect(screen.getByLabelText('Cân nhập mới (kg)')).toHaveValue(260)
  expect(screen.getByLabelText('Lý do')).toHaveValue('Sửa cân nhập')
  expect(state.get).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await user.click(await screen.findByRole('button', { name: 'Tải bản mới nhất' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.get).toHaveBeenCalledTimes(2)
  expect(state.correct.mock.calls.every(([, input]) => input.expectedVersion === 0 && input.voucherVersion === 3)).toBe(true)
})

it('disables saving during preflight and retries a load error without losing input', async () => {
  state.check.mockRejectedValueOnce(new Error('Không tải được kiểm tra'))
  const user = await openLine()
  await user.type(screen.getByLabelText('Lý do'), 'Lý do giữ lại')
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(state.check).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('Lý do')).toHaveValue('Lý do giữ lại')
})

it('blocks submission of otherwise valid input until preflight completes', async () => {
  let finish: (value: EntryLineVoidCheck) => void = () => undefined
  state.check.mockReturnValue(new Promise<EntryLineVoidCheck>(resolve => { finish = resolve }))
  const user = userEvent.setup(); renderPage('?m=line&entry=91')
  await screen.findByText('Đang kiểm tra…')
  await weightAndReason(user)
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  expect(state.correct).not.toHaveBeenCalled()
  await act(async () => { finish({ entryId: 91, cattleCode: 'BC-001', eventsAfterEntry: [], canVoid: true, reason: null }) })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled())
})

it.each(['OWNER', 'MANAGER'])('allows %s to open a valid backend entry', async role => {
  state.role = role; await openLine(); expect(screen.getByRole('dialog')).toBeInTheDocument()
})
it.each(['TECHNICIAN', 'LOCAL', 'DRAFT', 'VOID', 'MISSING_ID'])('hides line actions for %s', async mode => {
  if (mode === 'TECHNICIAN') state.role = 'TECHNICIAN'
  if (mode === 'LOCAL') state.backend = false
  if (mode === 'DRAFT') state.get.mockResolvedValue({ ...voucher, status: 'Nháp' })
  if (mode === 'VOID') state.get.mockResolvedValue({ ...voucher, status: 'Đã hủy', detail: { cows: voucher.detail!.cows!.map(line => ({ ...line, lineStatus: 'VOID' })) } })
  if (mode === 'MISSING_ID') state.get.mockResolvedValue({ ...voucher, detail: { cows: voucher.detail!.cows!.map(line => ({ ...line, entryId: undefined })) } })
  renderPage(); await screen.findByRole('heading', { name: /Phiếu nhập PN-1/ })
  expect(screen.queryByRole('button', { name: 'Sửa / Hủy' })).not.toBeInTheDocument()
})
