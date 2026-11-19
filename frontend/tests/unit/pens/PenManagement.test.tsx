import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditModal from '../../../src/features/pen-management/components/EditModal'
import DisableModal from '../../../src/features/pen-management/components/DisableModal'
import type { Pen } from '../../../src/types'

const existingPens: Pen[] = [
  {
    code: 'A1',
    name: 'Chuồng sinh sản A1',
    count: 3,
    capacity: 10,
    status: 'ACTIVE',
    cows: [],
    purpose: 'Bò cái sinh sản',
    stage: 'Bò cái sinh sản',
    minAge: 12,
    minAgeOp: '≥',
    minWeight: 250,
    minWeightOp: '≥',
    version: 'v1 · 15/01/2026',
    desc: 'Khu vực bò sinh sản',
  },
  {
    code: 'B1',
    name: 'Chuồng vỗ béo B1',
    count: 5,
    capacity: 5,
    status: 'INACTIVE',
    cows: [],
    purpose: 'Vỗ béo',
    stage: 'Vỗ béo',
    version: 'v1 · 15/01/2026',
  },
]

describe('Pen Management Unit Tests (FE-04)', () => {
  describe('SCR-23: Create & Edit Pen Modal (EditModal)', () => {
    it('TC-PEN-U01: Validates required and unique pen code on creation', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const onClose = vi.fn()

      render(<EditModal barn={null} barns={existingPens} onSave={onSave} onClose={onClose} />)

      const saveButton = screen.getByRole('button', { name: /Lưu chuồng/i })
      await user.click(saveButton)

      expect(screen.getByText('Nhập mã chuồng')).toBeInTheDocument()
      expect(screen.getByText('Nhập tên chuồng')).toBeInTheDocument()
      expect(screen.getByText('Sức chứa phải là số nguyên ≥ 1')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()

      // Nhập mã đã tồn tại 'A1' (GBR-19, MSG-FE04-01)
      const codeInput = screen.getAllByRole('textbox')[0]
      await user.type(codeInput, 'A1')
      await user.click(saveButton)
      expect(screen.getByText('Mã chuồng đã tồn tại')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
    })

    it('TC-PEN-U02: Validates designed capacity must be an integer >= 1', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const onClose = vi.fn()

      render(<EditModal barn={null} barns={existingPens} onSave={onSave} onClose={onClose} />)

      const inputs = screen.getAllByRole('textbox')
      await user.type(inputs[0], 'C1')
      await user.type(inputs[1], 'Chuồng C1')
      await user.type(inputs[2], '0') // 0 is invalid (GBR-19, MSG-FE04-02)

      const saveButton = screen.getByRole('button', { name: /Lưu chuồng/i })
      await user.click(saveButton)

      expect(screen.getByText('Sức chứa phải là số nguyên ≥ 1')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()

      // Sửa thành 15 hợp lệ
      await user.clear(inputs[2])
      await user.type(inputs[2], '15')
      await user.click(saveButton)

      expect(screen.queryByText('Sức chứa phải là số nguyên ≥ 1')).not.toBeInTheDocument()
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'C1',
          name: 'Chuồng C1',
          capacity: 15,
        })
      )
    })

    it('TC-PEN-U03: Validates edited capacity cannot be less than current cattle headcount', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const onClose = vi.fn()

      // Chuồng A1 hiện có 3 con đang ở (barn.count = 3)
      render(<EditModal barn={existingPens[0]} barns={existingPens} onSave={onSave} onClose={onClose} />)

      // Mã chuồng ở chế độ sửa là readonly (GBR-19)
      const inputs = screen.getAllByRole('textbox')
      const codeInput = inputs[0]
      expect(codeInput).toHaveAttribute('readonly')

      // Sức chứa ở vị trí thứ 3 (index 2: code readonly, name, capacity)
      const capacityInput = inputs[2]

      // Hạ sức chứa xuống 2 (< 3 con đang ở) (GBR-19, MSG-FE04-03)
      await user.clear(capacityInput)
      await user.type(capacityInput, '2')

      const saveButton = screen.getByRole('button', { name: /Lưu chuồng/i })
      await user.click(saveButton)

      expect(screen.getByText('Không nhỏ hơn số bò đang ở (3)')).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()

      // Tăng sức chứa lên 8 (>= 3 con đang ở)
      await user.clear(capacityInput)
      await user.type(capacityInput, '8')
      await user.click(saveButton)

      expect(screen.queryByText(/Không nhỏ hơn số bò/i)).not.toBeInTheDocument()
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'A1',
          capacity: 8,
          count: 3,
        })
      )
    })

    it('TC-PEN-U04: Keeps the backend optimistic-lock version for update', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const onClose = vi.fn()

      render(<EditModal barn={existingPens[0]} barns={existingPens} onSave={onSave} onClose={onClose} />)

      const saveButton = screen.getByRole('button', { name: /Lưu chuồng/i })
      await user.click(saveButton)

      // The backend owns optimistic-lock increments. The form must send the
      // version it loaded, not a locally incremented value.
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'A1',
          version: 'v1 · 15/01/2026',
        })
      )
    })
  })

  describe('SCR-24: Disable & Resume Pen Modal (DisableModal)', () => {
    it('TC-PEN-U05: Requires mandatory reason when suspending pen (INACTIVE)', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const onClose = vi.fn()

      // Chuồng A1 đang ACTIVE
      render(<DisableModal barn={existingPens[0]} onConfirm={onConfirm} onClose={onClose} />)

      expect(screen.getByText(/Ngừng sử dụng chuồng – A1/i)).toBeInTheDocument()
      expect(screen.getByText('3 / 10 con')).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', { name: /Xác nhận/i })
      const reasonTextarea = screen.getByRole('textbox')

      // Xóa lý do thành rỗng -> nút xác nhận phải bị disabled (GBR-20, MSG-FE04-06)
      await user.clear(reasonTextarea)
      expect(confirmButton).toBeDisabled()

      // Nhập lý do tạm ngưng
      await user.type(reasonTextarea, 'Khử trùng định kỳ và sửa chữa máng nước')
      expect(confirmButton).toBeEnabled()

      await user.click(confirmButton)
      expect(onConfirm).toHaveBeenCalledWith('INACTIVE', {
        date: '2026-10-20',
        reason: 'Khử trùng định kỳ và sửa chữa máng nước',
      })
    })

    it('TC-PEN-U06: Requires mandatory reason when resuming pen (ACTIVE)', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const onClose = vi.fn()

      // Chuồng B1 đang INACTIVE
      render(<DisableModal barn={existingPens[1]} onConfirm={onConfirm} onClose={onClose} />)

      expect(screen.getByText(/Mở lại sử dụng chuồng – B1/i)).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', { name: /Xác nhận/i })
      const reasonTextarea = screen.getByRole('textbox')

      // Ban đầu reason rỗng khi mở lại -> disabled
      expect(confirmButton).toBeDisabled()

      // Nhập lý do mở lại
      await user.type(reasonTextarea, 'Đã hoàn tất bảo dưỡng máng ăn')
      expect(confirmButton).toBeEnabled()

      await user.click(confirmButton)
      expect(onConfirm).toHaveBeenCalledWith('ACTIVE', {
        date: '2026-10-20',
        reason: 'Đã hoàn tất bảo dưỡng máng ăn',
      })
    })
  })
})
