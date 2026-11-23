import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimelineCorrectionDialog, { hasTimelineCorrection } from '../../../src/features/cattle/components/TimelineCorrectionDialog'
import { mapTimeline, timelineMeta } from '../../../src/features/cattle/api/cattleTimeline'

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('../../../src/features/cattle/hooks/useCattleCommands', () => ({
  useTimelineCorrectionCommand: () => ({ mutate }),
  useCattleVaccineOptions: () => ({ data: [
    { id: 1, name: 'Vắc-xin A', withdrawalDays: 7 },
    { id: 2, name: 'Vắc-xin B', withdrawalDays: 21 },
    { id: 3, name: 'Không tham chiếu', withdrawalDays: null },
  ] }),
}))

beforeEach(() => mutate.mockReset().mockResolvedValue({}))
afterEach(cleanup)

function open(source = 'ON_FARM') {
  const event = mapTimeline({ category: 'VACCINATION', type: 'VACCINATION_RECORD', sourceId: 77,
    occurredAt: '2026-10-01T17:30:00Z', canCorrect: true, canOpen: true,
    values: { version: 2, source, vaccineId: 1, vaccine: 'Vắc-xin A', administeredAt: '2026-10-01T17:30:00Z',
      vaccinationDate: '2026-10-02', withdrawalDays: 7, dose: '1 ml', vaccinator: 'Quản lý' },
  }, 0)
  if (!hasTimelineCorrection(event)) throw new Error('Fixture is not correctable')
  const saved = vi.fn()
  render(<TimelineCorrectionDialog event={event} onClose={vi.fn()} onSaved={saved} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Lý do' }), { target: { value: 'Sửa ghi nhầm' } })
  return saved
}

describe('FE-16 original snapshots and nullable metadata', () => {
  it.each([
    ['VACCINATION_RECORD', { vaccineName: 'Vắc-xin A' }, 'Tiêm Vắc-xin A'],
    ['TREATMENT', { medicineName: 'Thuốc A' }, 'Điều trị – Thuốc A'],
  ])('describes %s with its original name', (sourceType, original, title) => {
    const event = mapTimeline({ type: 'REVISION', status: 'CORRECT', occurredAt: '2026-10-01T03:00:00Z',
      values: { original }, correction: { sourceType } }, 0)
    expect(event.title).toBe(`Giá trị trước khi sửa: ${title}`)
    expect(event.meta).toBe('Xảy ra 01/10/2026 10:00')
  })

  it('keeps current snapshot names in preference to legacy aliases and handles malformed originals', () => {
    expect(mapTimeline({ type: 'REVISION', values: { original: { vaccine: 'A', vaccineName: 'B' } }, correction: { sourceType: 'VACCINATION_RECORD' } }, 0).title).toContain('Tiêm A')
    expect(() => mapTimeline({ type: 'REVISION', values: { original: null }, correction: { sourceType: 'VACCINATION_RECORD' } }, 0)).not.toThrow()
    expect(timelineMeta(null, null, null)).toBe('')
    expect(timelineMeta(null, null, 'Người ghi')).toBe('bởi Người ghi')
  })

  it('shows a voided exit reason without granting access to the voucher', () => {
    expect(mapTimeline({ type: 'HERD_EXIT', category: 'ENTRY_EXIT', status: 'VOIDED', sourceId: null,
      canOpen: false, canCorrect: false, values: { exitType: 'SALE', reason: 'Ghi trùng' } }, 0))
      .toMatchObject({ reason: 'Ghi trùng', status: 'VOIDED', openDenied: true, voucher: undefined })
  })

  it('keeps the original entry weight and basis from the source snapshot keys', () => {
    const event = mapTimeline({ type: 'REVISION', values: { original: { entryWeightKg: 320, weightBasis: 'MEASURED' } }, correction: { sourceType: 'HERD_ENTRY' } }, 0)
    expect(event.detail).toContain('Cân nhập 320 kg')
  })
})

describe('FE-16 vaccination withdrawal correction (FE-09 R-09-08/14)', () => {
  it('prefills ON_FARM days and computes the end from the UTC+7 injection date', () => {
    open()
    expect(screen.getByLabelText('Ngày ngưng thịt')).toHaveValue(7)
    expect(screen.getByLabelText('Ngày hết ngưng thịt')).toHaveValue('2026-10-09')
    expect(screen.getByLabelText('Ngày hết ngưng thịt')).toHaveAttribute('readonly')
    fireEvent.change(screen.getByLabelText('Thời điểm tiêm'), { target: { value: '2026-10-03T08:00' } })
    expect(screen.getByLabelText('Ngày hết ngưng thịt')).toHaveValue('2026-10-10')
  })

  it.each(['-1', '366', '1.5', ''])('rejects invalid days %s at the field without a request', async (value) => {
    open()
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value } })
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }).closest('form')!)
    expect(await screen.findByText(/MSG-COM-10/)).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Ngày ngưng thịt')).toHaveAttribute('aria-invalid', 'true')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('defaults days from a new vaccine, preserves manual overrides, and handles no catalogue default', async () => {
    const user = userEvent.setup()
    open()
    await user.selectOptions(screen.getByLabelText('Vắc-xin'), '2')
    expect(screen.getByLabelText('Ngày ngưng thịt')).toHaveValue(21)
    expect(screen.getByText('Đã điền ngày ngưng thịt theo vắc-xin mới, kiểm tra lại trước khi lưu.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Vắc-xin'), '3')
    expect(screen.getByLabelText('Ngày ngưng thịt')).toHaveValue(21)
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value: '10' } })
    await user.selectOptions(screen.getByLabelText('Vắc-xin'), '1')
    expect(screen.getByLabelText('Ngày ngưng thịt')).toHaveValue(10)
    expect(screen.queryByText('Đã điền ngày ngưng thịt theo vắc-xin mới, kiểm tra lại trước khi lưu.')).not.toBeInTheDocument()
  })

  it.each([0, 365])('sends a changed boundary %s with version, reason and an idempotency key', async (value) => {
    const user = userEvent.setup()
    const saved = open()
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value: String(value) } })
    if (value === 0) {
      expect(screen.getByLabelText('Ngày hết ngưng thịt')).toHaveValue('')
      expect(screen.getByText('Không có thời gian ngưng thịt.')).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    await waitFor(() => expect(saved).toHaveBeenCalledOnce())
    expect(mutate).toHaveBeenCalledWith({ path: '/vaccinations', sourceId: 77, action: 'correction',
      body: { expectedVersion: 2, reason: 'Sửa ghi nhầm', withdrawalDays: value }, key: expect.any(String) })
  })

  it('omits unchanged withdrawal days', async () => {
    open()
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value: '07' } })
    fireEvent.change(screen.getByLabelText('Liều'), { target: { value: '2 ml' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(mutate.mock.calls[0][0].body).toEqual({ expectedVersion: 2, reason: 'Sửa ghi nhầm', dose: '2 ml' })
  })

  it('reuses a key for an unchanged retry and replaces it when the withdrawal payload changes', async () => {
    mutate.mockRejectedValueOnce(new Error('Mất kết nối')).mockRejectedValueOnce(new Error('Mất kết nối'))
    open()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(mutate.mock.calls[1][0].key).toBe(mutate.mock.calls[0][0].key)
    fireEvent.change(screen.getByLabelText('Ngày ngưng thịt'), { target: { value: '11' } })
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(mutate.mock.calls[2][0].key).not.toBe(mutate.mock.calls[0][0].key)
  })

  it('HISTORICAL hides withdrawal fields and never sends catalogue days when changing vaccine', async () => {
    open('HISTORICAL')
    expect(screen.queryByLabelText('Ngày ngưng thịt')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ngày hết ngưng thịt')).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Vắc-xin'), '2')
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(mutate.mock.calls[0][0].body).toEqual({ expectedVersion: 2, reason: 'Sửa ghi nhầm', vaccineId: 2 })
  })
})
