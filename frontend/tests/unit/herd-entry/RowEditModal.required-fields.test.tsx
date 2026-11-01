import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow, Pen } from '../../../src/types'

const eligiblePen: Pen = {
  code: 'B1',
  name: 'B1 – Vỗ béo',
  count: 10,
  capacity: 30,
  status: 'ACTIVE',
  cows: [],
}

const completeCow: EntryCow = {
  tag: '',
  name: '',
  breed: 'Lai Sind',
  sex: 'Cái',
  dob: '2025-04',
  dobAccuracy: 'Ước tính',
  stage: 'Bò tơ',
  purpose: 'Bò vỗ béo · loại Vỗ béo',
  weight: 236,
  estimated: false,
  barn: 'B1',
  unitPrice: 85_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

function renderModal(cow: EntryCow, onSave = vi.fn()) {
  render(
    <RowEditModal
      cow={cow}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      pricing="kg"
      others={[]}
      pens={[eligiblePen]}
      onSave={onSave}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  return onSave
}

it('chặn lưu ngay trong popup khi cân nhập theo kg không hợp lệ', async () => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, weight: 0 })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Cân nhập phải từ 1 đến 1.500 kg.')).toBeInTheDocument()
})

it('chặn lưu ngay trong popup khi chưa chọn chuồng nhận', async () => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, barn: '' })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Vui lòng chọn chuồng nhận.')).toBeInTheDocument()
})

it('hiển thị lỗi tại popup và không lưu khi chưa chọn giống', async () => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, breed: '' })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Vui lòng chọn giống.')).toBeInTheDocument()
})
