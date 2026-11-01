import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal, { purposesForSex, stagesForSex } from '../../../src/features/herd-entry/components/RowEditModal'
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
  tag: 'TEST-ENTRY-001',
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

function renderModal(cow: EntryCow, onSave = vi.fn(), vaccines: Array<{ id: number; code: string; name: string; available: boolean }> = []) {
  render(
    <RowEditModal
      cow={cow}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      pricing="kg"
      others={[]}
      pens={[eligiblePen]}
      vaccines={vaccines}
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

it('cho chỉnh ngày sinh bằng lịch ngày tháng năm và giữ giá trị ngày đã chọn', () => {
  const onSave = renderModal(completeCow)
  const date = screen.getByLabelText('Ngày sinh') as HTMLInputElement

  expect(date).toHaveAttribute('type', 'date')
  // Drafts created with month-only precision remain editable in the native
  // calendar by using the first day as the input representation.
  expect(date).toHaveValue('2025-04-01')
  expect(date).toHaveAttribute('max', '2026-10-29')

  fireEvent.change(date, { target: { value: '2025-04-17' } })
  expect(date).toHaveValue('2025-04-17')

  fireEvent.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dob: '2025-04-17' }))
})

it('hiển thị lỗi tại popup và không lưu khi chưa chọn giống', async () => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, breed: '' })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Vui lòng chọn giống.')).toBeInTheDocument()
})

it('hiển thị cảnh báo tiêu chí ngay khi chọn chuồng và không chặn lưu', async () => {
  const onSave = vi.fn()
  render(
    <RowEditModal
      cow={{ ...completeCow, weight: 20, barn: 'B1' }}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      others={[]}
      pens={[{ ...eligiblePen, receptionCriteria: { minWeightKg: 200 } }]}
      onSave={onSave}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  expect(screen.getByText(/Không phù hợp tiêu chí chuồng/)).toBeInTheDocument()
  expect(screen.getByText(/Cân nặng tối thiểu: 200 kg/)).toBeInTheDocument()

  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ warningReason: 'Không phù hợp tiêu chí chuồng' }))
})

it('ẩn xóa con với dòng nháp mới và chỉ hiện với dòng đã có mã hồ sơ', () => {
  renderModal(completeCow)
  expect(screen.queryByRole('button', { name: 'Xóa con khỏi phiếu' })).not.toBeInTheDocument()
  cleanup()

  renderModal({ ...completeCow, code: 'BC-000248' })
  expect(screen.getByRole('button', { name: 'Xóa con khỏi phiếu' })).toBeInTheDocument()
})

it('cho nhập chi tiết lịch sử theo từng khai báo', async () => {
  const user = userEvent.setup()
  renderModal(completeCow)

  const vaccineDetail = screen.getByLabelText('Chi tiết tiêm phòng')
  const diseaseDetail = screen.getByLabelText('Chi tiết bệnh đã biết')
  const reproductionDetail = screen.getByLabelText('Chi tiết sinh sản')
  expect(vaccineDetail).toBeDisabled()
  expect(diseaseDetail).toBeDisabled()
  expect(reproductionDetail).toBeDisabled()

  const yesRadios = screen.getAllByRole('radio', { name: 'Có' })
  await user.click(yesRadios[0])
  await user.click(yesRadios[1])
  await user.click(yesRadios[2])
  expect(vaccineDetail).toBeEnabled()
  expect(diseaseDetail).toBeEnabled()
  expect(reproductionDetail).toBeEnabled()

  await user.click(vaccineDetail)
  await user.type(screen.getByLabelText('Tên vaccine tự do'), 'LMLM 03/2026')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(vaccineDetail).toHaveTextContent('Chi tiết (đã nhập)')

  await user.click(diseaseDetail)
  await user.type(screen.getByLabelText('Mô tả bệnh'), 'Viêm móng cũ')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(diseaseDetail).toHaveTextContent('Chi tiết (đã nhập)')

  await user.click(reproductionDetail)
  await user.selectOptions(screen.getByLabelText('Đang mang thai'), 'YES')
  await user.type(screen.getByLabelText('Số tháng mang thai'), '4')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(reproductionDetail).toHaveTextContent('Chi tiết (đã nhập)')
})

it('chỉ hiện số tháng mang thai khi đang mang thai và xóa giá trị khi chọn không', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, repro: 'Có', pregnantAtEntry: 'UNKNOWN', pregnancyMonths: 4 } })

  await user.click(screen.getByRole('button', { name: 'Chi tiết sinh sản' }))
  expect(screen.getByLabelText('Số tháng mang thai')).toBeDisabled()

  await user.selectOptions(screen.getByLabelText('Đang mang thai'), 'YES')
  expect(screen.getByLabelText('Số tháng mang thai')).toHaveValue(4)
  expect(screen.getByLabelText('Số tháng mang thai')).toBeEnabled()
  await user.selectOptions(screen.getByLabelText('Đang mang thai'), 'NO')
  expect(screen.getByLabelText('Số tháng mang thai')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getByRole('button', { name: 'Chi tiết sinh sản' })).toHaveTextContent('Chi tiết')

})

it('hiển thị catalogue vaccine và giữ vaccineId khi chọn', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, vaccine: 'Có' } }, vi.fn(), [{ id: 55, code: 'LMLM', name: 'Lở mồm long móng', available: true }])
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  const catalogue = screen.getByLabelText('Chọn vaccine trong danh mục 1')
  expect(catalogue).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'LMLM · Lở mồm long móng' })).toBeInTheDocument()
  await user.selectOptions(catalogue, 'id:55')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' })).toHaveTextContent('Chi tiết (đã nhập)')
})

it('cho thêm và xóa từng dòng vaccine, nhưng bệnh chỉ có một mô tả', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, vaccine: 'Có', disease: 'Có' } }, vi.fn(), [{ id: 55, code: 'LMLM', name: 'Lở mồm long móng', available: true }])
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  await user.click(screen.getByRole('button', { name: '+ Thêm vaccine' }))
  expect(screen.getByLabelText('Tên vaccine tự do 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xóa vaccine 2' }))
  expect(screen.queryByLabelText('Tên vaccine tự do 2')).not.toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
  await user.click(screen.getByRole('button', { name: 'Chi tiết bệnh đã biết' }))
  expect(screen.getByLabelText('Mô tả bệnh')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Thêm bệnh|Xóa bệnh/ })).not.toBeInTheDocument()
  expect(screen.getByText('Tối đa 1.000 ký tự.')).toBeInTheDocument()
})

it('cuộn riêng danh sách vaccine khi có nhiều dòng và giữ vùng thao tác ổn định', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, vaccine: 'Có' } }, vi.fn(), [{ id: 55, code: 'LMLM', name: 'Lở mồm long móng', available: true }])
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  const addVaccine = screen.getByRole('button', { name: '+ Thêm vaccine' })
  for (let i = 0; i < 8; i += 1) await user.click(addVaccine)

  const list = screen.getByRole('region', { name: 'Danh sách vaccine' })
  expect(list).toHaveClass('max-h-[220px]', 'overflow-y-auto')
  expect(screen.getByRole('button', { name: 'Lưu chi tiết' })).toBeVisible()
})

it('chỉ mở và lọc giai đoạn, mục đích sau khi chọn giới tính', async () => {
  const user = userEvent.setup()
  expect(stagesForSex('').length).toBe(0)
  expect(stagesForSex('Đực').some((stage) => stage.value === 'Bò cái')).toBe(false)
  expect(stagesForSex('Đực').some((stage) => stage.value === 'Đực giống')).toBe(true)
  expect(stagesForSex('Cái').some((stage) => stage.value === 'Đực giống')).toBe(false)
  expect(stagesForSex('Cái').some((stage) => stage.value === 'Bò cái')).toBe(true)
  expect(purposesForSex('Đực').some((purpose) => /sinh sản/i.test(purpose))).toBe(false)
  expect(purposesForSex('Cái').some((purpose) => /vỗ béo|đực giống/i.test(purpose))).toBe(false)

  cleanup()
  renderModal({ ...completeCow, sex: '', stage: '', purpose: '' })
  const comboboxes = screen.getAllByRole('combobox')
  expect(comboboxes[1]).toBeDisabled()
  expect(comboboxes[2]).toBeDisabled()
  expect(screen.getByText('Chọn giới tính trước để mở danh sách giai đoạn sinh trưởng và mục đích nuôi.')).toBeInTheDocument()

  cleanup()
  renderModal({ ...completeCow, purpose: 'Giữ giống · loại Đực giống', sex: 'Đực', stage: 'Đực giống' })
  expect(screen.getByRole('radio', { name: 'Đực' })).toBeChecked()
  expect(screen.getByRole('option', { name: 'Đực giống' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Bò cái' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Cái' }))
  expect(screen.getByText('Giai đoạn sinh trưởng hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.')).toBeInTheDocument()
  const changedSexComboboxes = screen.getAllByRole('combobox')
  expect(changedSexComboboxes[1]).toHaveValue('')
  expect(changedSexComboboxes[2]).toHaveValue('')
})
