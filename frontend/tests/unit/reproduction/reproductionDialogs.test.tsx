import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReproductionActionDialog from '../../../src/features/reproduction/components/ReproductionActionDialog'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import type { ReproductionFemale } from '../../../src/features/reproduction/types'

type Target = Parameters<typeof ReproductionActionDialog>[0]['target']
const cow = (code: string): ReproductionFemale => REPRODUCTION_DEMO.find((row) => row.cattleCode === code)!
const eventOf = (code: string, id: string) => cow(code).events.find((event) => event.id === id)!

function open(target: Target, code: string) {
  const handlers = {
    onClose: vi.fn(), onRecord: vi.fn(async () => undefined), onCorrectEvent: vi.fn(async () => undefined),
    onVoidEvent: vi.fn(async () => undefined), onCorrectCalving: vi.fn(async () => undefined),
    onVoidCalving: vi.fn(async () => undefined), onVoidCalf: vi.fn(async () => undefined),
  }
  render(<MemoryRouter><ReproductionActionDialog target={target} profile={cow(code)} {...handlers} /></MemoryRouter>)
  return { user: userEvent.setup(), ...handlers }
}

describe('record dialogs follow the Figma frames', () => {
  it('estrus: signs use the frame wording and the observer comes from the member list', async () => {
    const { user, onRecord } = open({ mode: 'record', action: 'RECORD_ESTRUS' }, 'BC-000142')
    const dialog = screen.getByRole('dialog', { name: 'Ghi động dục' })
    for (const sign of ['Đứng yên cho nhảy', 'Chảy dịch nhờn trong', 'Nhảy lên con khác', 'Kêu rống', 'Âm hộ sưng đỏ']) {
      expect(within(dialog).getByRole('checkbox', { name: sign })).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('option', { name: 'Lê Thị Mai · Kỹ thuật viên' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Bò cái')).toHaveValue('BC-000142 · Số tai 0142 · Zebu đỏ · C1')

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Người quan sát' }), 'Lê Thị Mai')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Đứng yên cho nhảy' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chảy dịch nhờn trong' }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu động dục' }))

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ESTRUS', observer: 'Lê Thị Mai', signs: ['Đứng yên cho nhảy', 'Chảy dịch nhờn trong'],
    }))
  })

  it('breeding: shows the eligibility badge, links the latest estrus and computes the read-only expected date', async () => {
    const { user, onRecord } = open({ mode: 'record', action: 'RECORD_BREEDING' }, 'BC-000142')
    const dialog = screen.getByRole('dialog', { name: 'Ghi phối giống – lần phối 1' })
    expect(within(dialog).getByText('Đạt 3/3 · tuổi, cân nặng, sức khỏe')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Thời điểm phối'), { target: { value: '2026-10-20T15:10' } })
    expect(within(dialog).getByRole('combobox', { name: 'Liên kết động dục' })).toHaveValue('re-142-e3')
    const expected = within(dialog).getByLabelText('Ngày dự kiến đẻ (tạm tính)')
    expect(expected).toHaveValue('30/07/2027')
    expect(expected).toHaveAttribute('readonly')

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Đực giống trong trại' }), 'sire-1')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu phối giống' }))
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'BREEDING', linkedEstrusId: 're-142-e3', sireSource: 'FARM', farmSireId: 'sire-1', method: 'NATURAL_SERVICE',
    }))
  })

  it('breeding: a female who does not meet the conditions gets a warning but can still save', async () => {
    const { user, onRecord } = open({ mode: 'record', action: 'RECORD_BREEDING' }, 'BC-000188')
    const dialog = screen.getByRole('dialog', { name: 'Ghi phối giống – lần phối 1' })
    expect(within(dialog).getByText(/Chưa đạt 2\/3 · cân nặng/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Chưa đạt điều kiện phối.*vẫn có thể ghi/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Ngoài trại' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Giống tinh / đực giống' }), 'Brahman đỏ')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu phối giống' }))
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'BREEDING', sireSource: 'EXTERNAL', externalSireBreed: 'Brahman đỏ' }))
  })

  it('pregnancy check: proposes the latest breeding and shows the read-only expected date', () => {
    open({ mode: 'record', action: 'RECORD_PREGNANCY_CHECK' }, 'BC-000061')
    const dialog = screen.getByRole('dialog', { name: 'Ghi khám thai' })
    expect(within(dialog).getByRole('combobox', { name: 'Lần phối liên kết' })).toHaveValue('re-061-b1')
    expect(within(dialog).getByLabelText('Ngày dự kiến đẻ')).toHaveValue('30/06/2027')
    expect(within(dialog).getByRole('radio', { name: 'Chưa xác định' })).toBeInTheDocument()
  })

  it('pregnancy update: a loss asks for confirmation before saving and the case link is only for complications', async () => {
    const { user, onRecord } = open({ mode: 'record', action: 'RECORD_PREGNANCY_UPDATE' }, 'BC-000087')
    const dialog = screen.getByRole('dialog', { name: 'Ghi diễn biến thai' })
    expect(within(dialog).queryByLabelText('Liên kết ca bệnh')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Biến chứng' }))
    expect(within(dialog).getByRole('option', { name: 'HC-0415 · Phù chân sau – cận đẻ' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Sẩy thai' }))
    expect(within(dialog).queryByLabelText('Liên kết ca bệnh')).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Chi tiết' }), 'Bò sẩy thai ở tháng thứ 8')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu diễn biến' }))
    expect(onRecord).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/Sẩy thai sẽ kết thúc thai kỳ/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'PREGNANCY_UPDATE', updateType: 'LOSS' }))
  })
})

describe('correct and void dialogs show current against new values and need a reason', () => {
  it('estrus: shows the record, the value table and saves a correction only with a reason', async () => {
    const event = eventOf('BC-000142', 're-142-e2')
    const { user, onCorrectEvent } = open({ mode: 'revise', record: { kind: 'event', event }, action: 'correct' }, 'BC-000142')
    const dialog = screen.getByRole('dialog', { name: 'Sửa / hủy bản ghi động dục' })
    expect(within(dialog).getByText('BC-000142 · 19/10/2026 18:10')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Bản ghi')).toHaveValue('Động dục · BC-000142 · 19/10/2026 18:10 · Lê Thị Mai')
    for (const heading of ['Trường thông tin', 'Giá trị hiện tại', 'Giá trị mới']) expect(within(dialog).getByText(heading)).toBeInTheDocument()
    expect(within(dialog).getAllByText('Bồn chồn, nhảy lên con khác').length).toBeGreaterThan(0)

    const save = within(dialog).getByRole('button', { name: 'Lưu chỉnh sửa' })
    expect(save).toBeDisabled()
    await user.clear(within(dialog).getByRole('textbox', { name: 'Mô tả' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), 'Bồn chồn, nhảy lên con khác, kêu rống')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Bổ sung dấu hiệu kêu rống theo sổ ghi chép')
    expect(save).toBeEnabled()
    await user.click(save)
    expect(onCorrectEvent).toHaveBeenCalledWith('re-142-e2', expect.objectContaining({ details: 'Bồn chồn, nhảy lên con khác, kêu rống', observer: 'Lê Thị Mai' }), 'Bổ sung dấu hiệu kêu rống theo sổ ghi chép')
  })

  it('estrus: warns before voiding a record that a breeding links to', async () => {
    const event = eventOf('BC-000061', 're-061-e1')
    const { user, onVoidEvent } = open({ mode: 'revise', record: { kind: 'event', event }, action: 'void' }, 'BC-000061')
    const dialog = screen.getByRole('dialog', { name: 'Sửa / hủy bản ghi động dục' })
    expect(within(dialog).getByRole('radio', { name: 'Hủy bản ghi' })).toBeChecked()
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Ghi nhầm bò')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy bản ghi' }))
    expect(onVoidEvent).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/đang được lần phối giống 20\/09\/2026 07:00 liên kết/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Vẫn hủy' }))
    expect(onVoidEvent).toHaveBeenCalledWith('re-061-e1', 'Ghi nhầm bò')
  })

  it('pregnancy check: has its own title and the six fields of the frame', async () => {
    const event = eventOf('BC-000087', 're-087-pc3')
    const { user, onCorrectEvent } = open({ mode: 'revise', record: { kind: 'event', event }, action: 'correct' }, 'BC-000087')
    const dialog = screen.getByRole('dialog', { name: 'Sửa / hủy kết quả khám thai' })
    expect(within(dialog).getByText('BC-000087 · khám 20/02/2026 08:30')).toBeInTheDocument()
    for (const field of ['Kết quả', 'Thời điểm khám', 'Phương pháp', 'Người khám', 'Nguồn dữ liệu', 'Lần phối liên kết']) {
      expect(within(dialog).getAllByText(field).length).toBeGreaterThan(0)
    }
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Phương pháp' }), 'ULTRASOUND')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Nhập nhầm phương pháp – đối chiếu sổ thú y')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(onCorrectEvent).toHaveBeenCalledWith('re-087-pc3', expect.objectContaining({ method: 'ULTRASOUND' }), 'Nhập nhầm phương pháp – đối chiếu sổ thú y')
  })

  it('pregnancy and calving: the record type switches the table and a calving correction leaves registered calves out', async () => {
    const event = eventOf('BC-000087', 're-087-pu1')
    const { user, onCorrectCalving } = open({ mode: 'revise', record: { kind: 'event', event }, action: 'correct' }, 'BC-000087')
    const dialog = screen.getByRole('dialog', { name: 'Sửa / hủy bản ghi mang thai & sinh bê' })
    expect(within(dialog).getByText('BC-000087 · thai kỳ 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Diễn biến thai' })).toBeChecked()
    expect(within(dialog).getByRole('combobox', { name: 'Loại cập nhật' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Sự kiện đẻ' }))
    expect(within(dialog).queryByRole('combobox', { name: 'Loại cập nhật' })).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Kiểu đẻ' }), 'ASSISTED')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Bổ sung diễn biến')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(onCorrectCalving).toHaveBeenCalledWith('calv-087-2', expect.objectContaining({ course: 'ASSISTED' }), 'Bổ sung diễn biến')
    expect(onCorrectCalving.mock.calls[0]![1]).not.toHaveProperty('calves')
  })
})
