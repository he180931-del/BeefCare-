import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal, { purposesForSex, stagesForSex } from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow } from '../../../src/features/herd-entry/types'
import type { Pen } from '../../../src/features/pen-management/types'

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

it.each([
  ['tuổi 0 tháng', { dob: '2026-10' }],
  ['tuổi 241 tháng', { dob: '2006-09' }],
  ['cân 1.501 kg', { weight: 1501 }],
  ['số tai 31 ký tự', { tag: 'T'.repeat(31) }],
] as const)('TC-06-18: blocks saving the specified invalid %s value', async (_label, patch) => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, ...patch })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
})

it('chặn lưu ngay trong popup khi chưa chọn chuồng nhận', async () => {
  const user = userEvent.setup()
  const onSave = renderModal({ ...completeCow, barn: '' })

  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Vui lòng chọn chuồng nhận.')).toBeInTheDocument()
})

it('edits birth month as an estimated first-of-month date with separate year and month pickers', () => {
 const save=renderModal(completeCow);const year=screen.getByLabelText('Năm sinh');const month=screen.getByLabelText('Tháng sinh');
 expect(year).toHaveValue('2025');expect(month).toHaveValue('04');
 // Years run from the entry year back 20 years; months after the entry month are disabled in the entry year.
 expect(within(year).getByRole('option',{name:'2026'})).toBeInTheDocument();expect(within(year).getByRole('option',{name:'2006'})).toBeInTheDocument();
 fireEvent.change(year,{target:{value:'2026'}});expect(within(month).getByRole('option',{name:'Tháng 11'})).toBeDisabled();expect(within(month).getByRole('option',{name:'Tháng 10'})).toBeEnabled();
 fireEvent.change(year,{target:{value:'2025'}});fireEvent.change(month,{target:{value:'05'}});fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(save).toHaveBeenCalledWith(expect.objectContaining({dob:'2025-05-01',dobAccuracy:'ESTIMATED'}))
})

it('blocks a year without a month and clears the birth date when both are emptied', () => {
 const save=renderModal(completeCow);fireEvent.change(screen.getByLabelText('Tháng sinh'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(save).not.toHaveBeenCalled();
 expect(screen.getByText('Chọn đủ tháng và năm sinh, hoặc để trống cả hai.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Năm sinh'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({dob:'',dobAccuracy:'UNKNOWN'}))
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

it('draft row without a cattle code can be removed after confirmation', async () => {
 renderModal(completeCow);await userEvent.click(screen.getByRole('button',{name:'Xóa con khỏi phiếu'}));expect(screen.getByRole('dialog',{name:'Xóa con #1 khỏi phiếu?'})).toBeInTheDocument()
})

it('cho nhập chi tiết lịch sử theo từng khai báo', async () => {
  const user = userEvent.setup()
  renderModal(completeCow)

  expect(screen.queryByLabelText('Chi tiết tiêm phòng')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Chi tiết bệnh đã biết')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Chi tiết sinh sản')).not.toBeInTheDocument()

  const yesRadios = screen.getAllByRole('radio', { name: 'Có' })
  await user.click(yesRadios[0])
  await user.click(yesRadios[1])
  await user.click(yesRadios[2])
  const vaccineDetail=screen.getByLabelText('Chi tiết tiêm phòng')
  const diseaseDetail=screen.getByLabelText('Chi tiết bệnh đã biết')
  const reproductionDetail=screen.getByLabelText('Chi tiết sinh sản')
  expect(vaccineDetail).toBeEnabled()
  expect(diseaseDetail).toBeEnabled()
  expect(reproductionDetail).toBeEnabled()

  await user.click(vaccineDetail)
  await user.type(screen.getByLabelText('Tên vaccine'), 'LMLM 03/2026')
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
  expect(screen.getByLabelText('Số tháng mang thai')).toHaveValue('4')
  expect(screen.getByLabelText('Số tháng mang thai')).toBeEnabled()
  await user.selectOptions(screen.getByLabelText('Đang mang thai'), 'NO')
  expect(screen.getByLabelText('Số tháng mang thai')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getByRole('button', { name: 'Chi tiết sinh sản' })).toHaveTextContent('Chi tiết')

})

it('keeps reproduction detail open for an out-of-range parity', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, repro: 'Có' } })
  await user.click(screen.getByRole('button', { name: 'Chi tiết sinh sản' }))
  const parity = screen.getByLabelText('Số lứa đã đẻ trước nhập đàn')
  await user.type(parity, '16')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getAllByText('Số lứa đã đẻ phải từ 0 đến 15.').length).toBeGreaterThan(0)
  await user.clear(parity)
  await user.type(parity, '15')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.queryByLabelText('Số lứa đã đẻ trước nhập đàn')).not.toBeInTheDocument()
})

it('hiển thị catalogue vaccine và giữ vaccineId khi chọn', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, vaccine: 'Có' } }, onSave, [{ id: 55, code: 'LMLM', name: 'Lở mồm long móng', available: true }])
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  // One name field: the catalogue only suggests names (no vaccine code) and a matching name keeps its ID.
  expect(screen.queryByLabelText('Chọn vaccine trong danh mục 1')).not.toBeInTheDocument()
  const name = screen.getByLabelText('Tên vaccine')
  expect(name).toHaveAttribute('list', 'entry-history-vaccine-options')
  expect(document.querySelector('#entry-history-vaccine-options option')).toHaveAttribute('value', 'Lở mồm long móng')
  await user.type(name, 'lở mồm long móng')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' })).toHaveTextContent('Chi tiết (đã nhập)')
  await user.click(screen.getByRole('button', { name: 'Lưu con #1' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ hist: expect.objectContaining({ vaccineItems: [expect.objectContaining({ vaccineId: 55, vaccineName: 'lở mồm long móng' })] }) }))
})

it('cho thêm và xóa từng dòng vaccine, nhưng bệnh chỉ có một mô tả', async () => {
  const user = userEvent.setup()
  renderModal({ ...completeCow, hist: { ...completeCow.hist, vaccine: 'Có', disease: 'Có' } }, vi.fn(), [{ id: 55, code: 'LMLM', name: 'Lở mồm long móng', available: true }])
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  await user.click(screen.getByRole('button', { name: '+ Thêm vaccine' }))
  expect(screen.getByLabelText('Tên vaccine 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xóa vaccine 2' }))
  expect(screen.queryByLabelText('Tên vaccine 2')).not.toBeInTheDocument()
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
  expect(purposesForSex('Cái').some((purpose) => /đực giống|giữ giống/i.test(purpose))).toBe(false)

  cleanup()
  renderModal({ ...completeCow, sex: '', stage: '', purpose: '' })
  expect(document.querySelector('#entry-cow-stage')).toBeDisabled()
  expect(document.querySelector('#entry-cow-purpose')).toBeDisabled()
  expect(screen.getByText('Chọn giới tính trước để mở danh sách giai đoạn sinh trưởng và mục đích nuôi.')).toBeInTheDocument()

  cleanup()
  renderModal({ ...completeCow, purpose: 'Giữ giống · loại Đực giống', sex: 'Đực', stage: 'Đực giống' })
  expect(screen.getByRole('radio', { name: 'Đực' })).toBeChecked()
  expect(screen.getByRole('option', { name: 'Đực giống' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Bò cái' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Cái' }))
  expect(screen.getByText('Giai đoạn sinh trưởng hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.')).toBeInTheDocument()
  expect(document.querySelector('#entry-cow-stage')).toHaveValue('')
  expect(document.querySelector('#entry-cow-purpose')).toHaveValue('')
})
