import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow, Pen } from '../../../src/types'

const cow: EntryCow = {
  tag: 'TEST-ENTRY-002',
  name: '',
  breed: 'Lai Sind',
  sex: 'Cái',
  dob: '2025-04',
  dobAccuracy: 'Ước tính',
  stage: 'Bò tơ',
  purpose: 'Bò sinh sản · loại Sinh sản',
  weight: 236,
  estimated: false,
  barn: 'A1',
  unitPrice: 85_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

const pens: Pen[] = [
  { code: 'A1', name: 'A1 – Bò cái', count: 10, capacity: 30, status: 'ACTIVE', cows: [] },
]

function renderModal(onSave = vi.fn()) {
  render(
    <RowEditModal
      cow={cow}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      pricing="kg"
      others={[]}
      pens={pens}
      onSave={onSave}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  const label = [...document.querySelectorAll('label')].find((node) => node.textContent?.includes('Cân nhập (kg)'))
  if (!label) throw new Error('Không tìm thấy nhãn Cân nhập')
  const input = label.parentElement?.querySelector('input')
  if (!input) throw new Error('Không tìm thấy ô Cân nhập')
  return { input: input as HTMLInputElement, onSave }
}

it('cho phép xóa số cũ rồi nhập trực tiếp 60 mà không giữ số 0 ở đầu', async () => {
  const user = userEvent.setup()
  const { input, onSave } = renderModal()

  await user.clear(input)
  expect(input).toHaveValue(null)

  await user.type(input, '60')
  expect(input).toHaveValue(60)

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weight: 60 }))
})

it('đưa cân nặng về 0 khi người dùng để trống rồi rời khỏi ô', async () => {
  const user = userEvent.setup()
  const { input } = renderModal()

  await user.clear(input)
  expect(input).toHaveValue(null)

  await user.tab()
  expect(input).toHaveValue(0)
})

it('khóa đơn giá và tính thành tiền bằng 0 khi chưa chọn cơ sở cân', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()

  render(
    <RowEditModal
      cow={{ ...cow, weight: 0, unitPrice: 85_000, weightBasis: null }}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      others={[]}
      pens={pens}
      onSave={onSave}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  const weight = document.querySelector('#entry-cow-weight') as HTMLInputElement
  expect(weight).toBeInTheDocument()
  expect(weight).toHaveValue(0)
  const unitPrice = document.querySelector('#entry-cow-unit-price') as HTMLInputElement
  expect(unitPrice).toBeDisabled()
  expect(unitPrice).toHaveValue(0)
  expect(screen.getByText('0 đ')).toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Cân thực tế' }))
  expect(unitPrice).toBeEnabled()
  await user.clear(weight)
  await user.type(weight, '236')
  // Đơn giá không bắt buộc (SCR-24 popup field 15, R-06-09): lưu được với đơn giá 0, chỉ là cảnh báo khi ghi sổ.
  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ weightBasis: 'MEASURED', weight: 236, unitPrice: 0 }))

  await user.clear(unitPrice)
  await user.type(unitPrice, '85000')
  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weightBasis: 'MEASURED', weight: 236, unitPrice: 85000 }))
})

it('theo con vẫn hiển thị và cho nhập cân/cơ sở cân, chỉ tính tiền theo giá/con', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(<RowEditModal cow={{ ...cow, pricing: 'con', weight: 236, unitPrice: 8500000, weightBasis: 'MEASURED' }} index={0} recordId="PN-2026-0014" dateIso="2026-10-29" others={[]} pens={pens} onSave={onSave} onRemove={vi.fn()} onClose={vi.fn()} />)
  const weight = document.querySelector('#entry-cow-weight') as HTMLInputElement
  expect(weight).toBeEnabled()
  expect(weight).toHaveValue(236)
  expect(screen.getByRole('radio', { name: 'Cân thực tế' })).toBeChecked()
  const unitPrice = document.querySelector('#entry-cow-unit-price') as HTMLInputElement
  expect(unitPrice).toBeDisabled()
  expect(unitPrice).toHaveValue(8500000)
  const totalAmount = document.querySelector('#entry-cow-total-amount') as HTMLInputElement
  expect(totalAmount).toBeEnabled()
  expect(totalAmount).toHaveValue(8500000)
  await user.clear(weight)
  await user.type(weight, '250')
  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pricing: 'con', weight: 250, weightBasis: 'MEASURED', unitPrice: 8500000 }))
})
