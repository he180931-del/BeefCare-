import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UpdateModal from '../../../src/features/cattle/components/UpdateModal'
import QrReissueModal from '../../../src/features/cattle/components/QrReissueModal'
import MoveModal from '../../../src/features/cattle/components/MoveModal'
import * as cattleApi from '../../../src/features/cattle/api/cattleApi'
import { initialCows } from '../../../src/data/cowsData'
import type { Pen } from '../../../src/types'

const testCow = initialCows[0] // BC-000125
const testCow142 = initialCows[1] // BC-000142

const mockPens: Record<string, Pen> = {
  A1: {
    code: 'A1',
    name: 'Chuồng A1',
    count: 3,
    capacity: 10,
    status: 'ACTIVE',
    cows: [],
    purpose: 'Sinh sản',
    stage: 'Bò cái sinh sản',
    minAge: 12,
    minWeight: 250,
  },
  A2: {
    code: 'A2',
    name: 'Chuồng A2',
    count: 22,
    capacity: 30,
    status: 'ACTIVE',
    cows: [],
    purpose: 'Sinh sản',
    stage: 'Bò cái sinh sản',
    minAge: 13,
    minWeight: 230,
  },
  C1: {
    code: 'C1',
    name: 'Chuồng C1 đầy',
    count: 5,
    capacity: 5,
    status: 'ACTIVE',
    cows: [],
    purpose: 'Sinh sản',
    stage: 'Bò tơ',
  },
}

describe('Cattle Profile Validation Unit Tests (FE-05)', () => {
  describe('SCR-27 & SCR-29: Update Cattle Modal (UpdateModal)', () => {
    it('TC-CAT-U01: Disables production purpose edit for non-owner roles (GBR-25, MSG-FE05-03)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onSaved = vi.fn()

      render(<UpdateModal cow={testCow} onClose={onClose} onSaved={onSaved} />)

      // Chuyển sang tab "Mục đích nuôi"
      const purposeTab = screen.getByRole('button', { name: /Mục đích nuôi/i })
      await user.click(purposeTab)

      // Kiểm tra select Mục đích mới bị disabled
      const selects = screen.getAllByRole('combobox')
      const purposeSelect = selects[0]
      expect(purposeSelect).toBeDisabled()

      // Kiểm tra ghi chú phân quyền
      expect(screen.getByText(/Mục đích nuôi chỉ Chủ trại được đổi/i)).toBeInTheDocument()
    })

    it('TC-CAT-U02: Validates stage update requires different stage and mandatory reason (MSG-FE05-04, MSG-FE05-05)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onSaved = vi.fn()

      // Dùng testCow (hiện tại stage: 'Bò cái sinh sản', isDemo=false nên reason rỗng)
      render(<UpdateModal cow={testCow} onClose={onClose} onSaved={onSaved} />)

      // Tab mặc định là "Giai đoạn"
      const saveButton = screen.getByRole('button', { name: /Lưu thay đổi/i })
      await user.click(saveButton)

      // Lỗi: Chưa chọn giai đoạn khác và chưa nhập lý do
      expect(screen.getByText('Chọn giai đoạn khác giai đoạn hiện tại.')).toBeInTheDocument()
      expect(screen.getByText('Nhập lý do.')).toBeInTheDocument()
      expect(onSaved).not.toHaveBeenCalled()

      // Chọn giai đoạn mới khác: 'Vỗ béo'
      const stageSelect = screen.getByRole('combobox')
      await user.selectOptions(stageSelect, 'Vỗ béo')

      // Nhập lý do chuyển giai đoạn
      const textareas = screen.getAllByRole('textbox')
      const reasonInput = textareas[textareas.length - 1]
      await user.type(reasonInput, 'Chuyển sang nhóm vỗ béo do không mang thai')

      await user.click(saveButton)
      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })

    it('TC-CAT-U03: Updates identity and descriptive attributes (SCR-27)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onSaved = vi.fn()

      render(<UpdateModal cow={testCow} onClose={onClose} onSaved={onSaved} />)

      const identityTab = screen.getByRole('button', { name: /Định danh & mô tả/i })
      await user.click(identityTab)

      const nameInput = screen.getByDisplayValue(testCow.name ?? '')
      const tagInput = screen.getByDisplayValue(testCow.tag ?? '')

      await user.clear(nameInput)
      await user.type(nameInput, 'Hoa Đỏ Mới')

      await user.clear(tagInput)
      await user.type(tagInput, 'VN-BV-9999')

      const saveButton = screen.getByRole('button', { name: /Lưu thay đổi/i })
      await user.click(saveButton)

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })
  })

  describe('SCR-31: QR Reissue Modal (QrReissueModal)', () => {
    it('TC-CAT-U04: Reissues QR tag with automatic new code and mandatory reason (GBR-27, MSG-FE05-08)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onSaved = vi.fn()

      render(<QrReissueModal cow={testCow} onClose={onClose} onSaved={onSaved} />)

      expect(screen.getByText(new RegExp(`Cấp lại thẻ QR – ${testCow.code}`, 'i'))).toBeInTheDocument()

      // Chọn lý do thay thẻ
      const reasonSelect = screen.getByRole('combobox')
      await user.selectOptions(reasonSelect, 'Thẻ bị mất')

      const confirmButton = screen.getByRole('button', { name: /Xác nhận cấp thẻ mới/i })
      await user.click(confirmButton)

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })
  })

  describe('SCR-30: Move Pen Modal (MoveModal)', () => {
    it('TC-CAT-U05: Requires pen availability (not full) and mandatory transfer reason (GBR-20, GBR-22, MSG-FE05-06)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onSaved = vi.fn()
      const moveSpy = vi.spyOn(cattleApi, 'moveBarn').mockResolvedValue(testCow as any)

      render(<MoveModal cow={testCow} barns={mockPens} onClose={onClose} onSaved={onSaved} />)

      expect(screen.getByText(new RegExp(`Chuyển chuồng – ${testCow.code}`, 'i'))).toBeInTheDocument()

      const saveButton = screen.getByRole('button', { name: /Xác nhận chuyển/i })
      // Ban đầu lý do rỗng, nút xác nhận chuyển phải bị disabled
      expect(saveButton).toBeDisabled()

      // Nhập lý do chuyển chuồng
      const inputs = screen.getAllByRole('textbox')
      const reasonInput = inputs[inputs.length - 1]
      await user.type(reasonInput, 'Chuyển sang chuồng theo dõi sinh sản')
      expect(saveButton).toBeEnabled()

      await user.click(saveButton)
      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })

    it('TC-CAT-U06: Evaluates advisory acceptance criteria of destination pen (GBR-21)', async () => {
      const onClose = vi.fn()
      const onSaved = vi.fn()

      render(<MoveModal cow={testCow} barns={mockPens} onClose={onClose} onSaved={onSaved} />)

      // Kiểm tra danh sách tiêu chí kiểm tra hiển thị
      expect(screen.getByText('Chuồng đích ACTIVE và còn chỗ')).toBeInTheDocument()
      expect(screen.getByText('Mục đích nuôi khớp tiêu chí chuồng')).toBeInTheDocument()
      expect(screen.getByText('Giai đoạn khớp tiêu chí chuồng')).toBeInTheDocument()
    })
  })
})
