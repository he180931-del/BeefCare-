import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow, Pen } from '../../../src/types'

const cow: EntryCow = {
  tag: '',
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
