import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { scanCode } from '../../../src/features/cattle/api/scanApi'
import { initialCows } from '../../../src/data/cowsData'
import PickModal from '../../../src/features/herd-exit/components/PickModal'

vi.mock('../../../src/features/cattle/api/scanApi', () => ({ scanCode: vi.fn() }))

it('adds an eligible cow by QR and rejects a QR that resolves outside the picker', async () => {
  const user = userEvent.setup()
  const cow = initialCows[0]
  const candidate = { code: cow.code, tag: cow.tag ?? '', breed: cow.breed ?? '', sex: cow.sex ?? '', age: '', group: '', stage: '', barn: 'A1', weight: 300, weightNote: '', estimated: false, unitPrice: 0 }
  const setPicked = vi.fn()
  vi.mocked(scanCode)
    .mockResolvedValueOnce({ kind: 'otherFarm', farmId: 22 })
    .mockResolvedValueOnce({ kind: 'found', cow: initialCows[1] })
    .mockResolvedValueOnce({ kind: 'found', cow })

  render(<PickModal id="PX-1" herdExits={[]} candidates={[candidate]} picked={[]} setPicked={setPicked} onClose={vi.fn()} />)
  const code = screen.getByRole('textbox', { name: 'Mã thẻ QR' })
  await user.type(code, 'QR-123')
  const submit = screen.getByRole('button', { name: 'Chọn theo mã' })
  await user.click(submit)
  expect(await screen.findByText('Bò thuộc trại khác.')).toBeInTheDocument()
  await user.click(submit)
  expect(await screen.findByText(`Bò ${initialCows[1].code} hiện không thể thêm vào phiếu này.`)).toBeInTheDocument()
  await user.click(submit)
  expect(await screen.findByText(`Đã chọn bò ${cow.code}.`)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thêm 1 con vào phiếu' }))
  expect(setPicked).toHaveBeenCalledWith([candidate])
})
