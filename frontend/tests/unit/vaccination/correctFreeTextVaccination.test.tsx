import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vaccinationApi } from '../../../src/features/vaccination/api/vaccinationApi'
import CorrectVaccinationModal from '../../../src/features/vaccination/components/CorrectVaccinationModal'
import type { VaccinationRecord } from '../../../src/features/vaccination/types'

// D82: mũi "Nhập lịch sử" khai bằng tên tự do lúc nhập đàn không có vắc-xin danh mục. Sửa bản ghi không được âm thầm
// thay tên đó bằng vắc-xin đầu danh mục.
const record: VaccinationRecord = {
  id: 501, cattleCode: 'BC-000125', vaccineLabel: 'Tụ huyết trùng (trại cũ)', administeredAt: '2026-09-15T00:00', precision: 'EXACT',
  source: 'HISTORICAL', vaccinator: 'Pre-entry declaration', withdrawalDays: 0, status: 'VALID', corrected: false, version: 0, revisions: [],
}

afterEach(() => vi.restoreAllMocks())

describe('Sửa mũi "Nhập lịch sử" tên tự do', () => {
  it('mặc định giữ tên cũ và không gửi vắc-xin danh mục', async () => {
    const correct = vi.spyOn(vaccinationApi, 'correctRecord').mockResolvedValue(undefined as never)
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<CorrectVaccinationModal record={record} onClose={vi.fn()} onSaved={onSaved} />)
    const select = await screen.findByRole('combobox', { name: 'Vắc-xin mới' })
    const dialog = screen.getByRole('dialog', { name: 'Sửa bản ghi tiêm' })
    expect(select).toHaveDisplayValue('Giữ: Tụ huyết trùng (trại cũ)')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    expect(correct).toHaveBeenCalledWith(501, expect.objectContaining({ vaccineId: undefined }))
    expect(onSaved).toHaveBeenCalledWith('Đã sửa bản ghi tiêm.')
  })

  it('mũi có vắc-xin danh mục không có lựa chọn "Giữ"', async () => {
    render(<CorrectVaccinationModal record={{ ...record, vaccineId: 1, vaccineLabel: 'LMLM' }} onClose={vi.fn()} onSaved={vi.fn()} />)
    const select = await screen.findByRole('combobox', { name: 'Vắc-xin mới' })
    expect(select).toHaveDisplayValue('Aftopor (LMLM type O)')
    expect(within(select).queryByRole('option', { name: /^Giữ:/ })).not.toBeInTheDocument()
  })
})
