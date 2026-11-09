import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditModal from '../../../src/features/pen-management/components/EditModal'
import DisableModal from '../../../src/features/pen-management/components/DisableModal'
import BarnPanel from '../../../src/features/pen-management/components/BarnPanel'
import MoveDialog from '../../../src/features/pen-management/components/MoveDialog'
import { penApi } from '../../../src/features/pen-management/api/penApi'
import { headerSummary, validateAvailability, validatePenForm } from '../../../src/features/pen-management/domain/penRules'
import type { Pen } from '../../../src/types'

const TODAY = '2026-11-07'

const existingPens: Pen[] = [
  {
    code: 'A1',
    name: 'Chuồng sinh sản A1',
    count: 3,
    capacity: 10,
    status: 'ACTIVE',
    cows: [],
    receptionCriteria: { purposeTypes: ['BREEDING'], lifeStages: ['ADULT'], sex: 'FEMALE', minAgeMonths: 12, minWeightKg: 250 },
    version: 'v1',
    lockVersion: 1,
    criteriaVersionNo: 2,
    criteriaEffectiveFrom: '2026-09-01',
    desc: 'Khu vực bò sinh sản',
  },
  { code: 'B1', name: 'Chuồng vỗ béo B1', count: 5, capacity: 5, status: 'INACTIVE', cows: [], receptionCriteria: {}, lockVersion: 4 },
]

const form = (overrides: Partial<Parameters<typeof validatePenForm>[0]> = {}) => ({ code: 'C-01', name: 'Chuồng C', capacity: '10', description: '', criteria: {}, ...overrides })
const create = { isNew: true, existingCodes: ['A1', 'B1'], headcount: 0 }

afterEach(() => vi.restoreAllMocks())

describe('FE-04 pen rules', () => {
  it('TC-04-01: pen code is 1–20 letters, digits or "-"', () => {
    expect(validatePenForm(form({ code: '' }), create).code).toBeTruthy()
    expect(validatePenForm(form({ code: 'A'.repeat(21) }), create).code).toBeTruthy()
    expect(validatePenForm(form({ code: 'C 01' }), create).code).toBeTruthy()
    expect(validatePenForm(form({ code: 'C_01' }), create).code).toBeTruthy()
    expect(validatePenForm(form({ code: 'C-01' }), create).code).toBeUndefined()
  })

  it('TC-04-02 (client side): duplicate code is rejected ignoring case', () => {
    expect(validatePenForm(form({ code: 'a1' }), create).code).toBe('Mã chuồng a1 đã tồn tại trong trại.')
  })

  it('TC-04-03: capacity 0 / 1 / 9.999 / 10.000 / 2,5', () => {
    expect(validatePenForm(form({ capacity: '0' }), create).capacity).toBeTruthy()
    expect(validatePenForm(form({ capacity: '1' }), create).capacity).toBeUndefined()
    expect(validatePenForm(form({ capacity: '9999' }), create).capacity).toBeUndefined()
    expect(validatePenForm(form({ capacity: '10000' }), create).capacity).toBeTruthy()
    expect(validatePenForm(form({ capacity: '2,5' }), create).capacity).toBeTruthy()
    expect(validatePenForm(form({ capacity: '2.5' }), create).capacity).toBeTruthy()
  })

  it('TC-04-04: capacity below the current headcount gives MSG-FE04-03 with the minimum', () => {
    const edit = { isNew: false, existingCodes: ['A1'], headcount: 30 }
    expect(validatePenForm(form({ capacity: '29' }), edit).capacity).toBe('Sức chứa phải là số nguyên, tối thiểu 30.')
    expect(validatePenForm(form({ capacity: '30' }), edit).capacity).toBeUndefined()
  })

  it('TC-04-05: minimum age 241, weight 0 and weight 1.501 are invalid', () => {
    expect(validatePenForm(form({ criteria: { MIN_AGE_MONTHS: '241' } }), create).MIN_AGE_MONTHS).toBeTruthy()
    expect(validatePenForm(form({ criteria: { MIN_AGE_MONTHS: '0' } }), create).MIN_AGE_MONTHS).toBeUndefined()
    expect(validatePenForm(form({ criteria: { MIN_WEIGHT_KG: '0' } }), create).MIN_WEIGHT_KG).toBeTruthy()
    expect(validatePenForm(form({ criteria: { MIN_WEIGHT_KG: '1501' } }), create).MIN_WEIGHT_KG).toBeTruthy()
    expect(validatePenForm(form({ criteria: { MIN_WEIGHT_KG: '1500' } }), create).MIN_WEIGHT_KG).toBeUndefined()
  })

  it('TC-04-09: effective date tomorrow and empty reason are rejected', () => {
    expect(validateAvailability('2026-11-08', 'Sửa mái', TODAY).date).toBe('Ngày hiệu lực không được ở tương lai.')
    expect(validateAvailability(TODAY, '  ', TODAY).reason).toBe('Vui lòng nhập Lý do.')
    expect(validateAvailability(TODAY, 'Sửa mái', TODAY)).toEqual({})
  })

  it('TC-04-25: header counts all pens but only the places of ACTIVE pens', () => {
    const pen = (code: string, count: number, capacity: number, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): Pen => ({ code, name: code, count, capacity, status, cows: [] })
    expect(headerSummary([pen('P1', 10, 20), pen('P2', 5, 10), pen('P3', 0, 5), pen('P4', 3, 10, 'INACTIVE')])).toEqual({ penCount: 4, used: 15, total: 35 })
  })
})

describe('Create / Edit Pen popup', () => {
  it('blocks saving with the field errors of the spec', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditModal barn={null} barns={existingPens} onSave={onSave} onClose={vi.fn()} today={TODAY} />)

    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(screen.getByText('Vui lòng nhập Mã chuồng.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập Tên chuồng.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập Sức chứa.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('creates a pen with multi-value criteria, initial status and no criterion type twice (TC-04-06)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditModal barn={null} barns={existingPens} onSave={onSave} onClose={vi.fn()} today={TODAY} />)

    const [code, name, capacity] = screen.getAllByRole('textbox')
    await user.type(code, 'C-01')
    await user.type(name, 'Bò tơ')
    await user.type(capacity, '40')
    expect(screen.getByText('Tiêu chí nhận bò · phiên bản mới từ 07/11/2026')).toBeInTheDocument()

    const add = screen.getByRole('combobox', { name: 'Thêm tiêu chí' })
    await user.selectOptions(add, 'PURPOSE_TYPE')
    await user.click(screen.getByText('Sinh sản'))
    await user.click(screen.getByText('Vỗ béo'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thêm tiêu chí' }), 'SEX')
    await user.click(screen.getByText('Cái'))
    // Một loại tiêu chí chỉ được thêm một lần: Giới tính không còn trong danh sách thêm.
    const options = within(screen.getByRole('combobox', { name: 'Thêm tiêu chí' })).getAllByRole('option').map((o) => o.textContent)
    expect(options).not.toContain('Giới tính')
    expect(options).not.toContain('Loại mục đích')

    await user.click(screen.getByText('INACTIVE'))
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      code: 'C-01', name: 'Bò tơ', capacity: 40, status: 'INACTIVE',
      receptionCriteria: { purposeTypes: ['BREEDING', 'FATTENING'], lifeStages: [], sex: 'FEMALE', minAgeMonths: null, minWeightKg: null },
    }))
  })

  it('requires a value for every added criterion', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditModal barn={null} barns={existingPens} onSave={onSave} onClose={vi.fn()} today={TODAY} />)
    const [code, name, capacity] = screen.getAllByRole('textbox')
    await user.type(code, 'C-02')
    await user.type(name, 'Bê')
    await user.type(capacity, '10')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thêm tiêu chí' }), 'LIFE_STAGE')
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(screen.getByText('Vui lòng chọn giá trị cho Giai đoạn.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('edits keep the code read-only, hide the initial status and send the loaded lock version', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditModal barn={existingPens[0]} barns={existingPens} onSave={onSave} onClose={vi.fn()} today={TODAY} />)

    const [code, , capacity] = screen.getAllByRole('textbox')
    expect(code).toHaveAttribute('readonly')
    expect(screen.queryByText('Trạng thái ban đầu')).not.toBeInTheDocument()
    await user.clear(capacity)
    await user.type(capacity, '2')
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(screen.getByText('Sức chứa phải là số nguyên, tối thiểu 3.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    await user.clear(capacity)
    await user.type(capacity, '8')
    // Xóa hết tiêu chí: chuồng nhận mọi bò.
    while (screen.queryAllByRole('button', { name: 'Xóa' }).length) await user.click(screen.getAllByRole('button', { name: 'Xóa' })[0])
    expect(screen.getByText('Chưa có tiêu chí: chuồng nhận mọi bò.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lưu chuồng/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ code: 'A1', capacity: 8, status: 'ACTIVE', lockVersion: 1, version: 'v1' }))
    expect(onSave.mock.calls[0][0].receptionCriteria.purposeTypes).toEqual([])
  })
})

describe('Stop / Resume Pen popup', () => {
  it('TC-04-09 / R-04-13: new status is the opposite one, date defaults to today, reason is required', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DisableModal barn={existingPens[0]} onConfirm={onConfirm} onClose={vi.fn()} today={TODAY} />)

    expect(screen.getByText(/Ngưng sử dụng chuồng – A1/i)).toBeInTheDocument()
    expect(screen.getByText('3 / 10 con')).toBeInTheDocument()
    expect(screen.getByText('07/11/2026')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: /Xác nhận/i })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Khử trùng định kỳ')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('INACTIVE', { date: TODAY, reason: 'Khử trùng định kỳ' })
  })

  it('resumes an INACTIVE pen to ACTIVE', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DisableModal barn={existingPens[1]} onConfirm={onConfirm} onClose={vi.fn()} today={TODAY} />)
    expect(screen.getByText(/Dùng lại chuồng – B1/i)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'Đã sửa xong mái')
    await user.click(screen.getByRole('button', { name: /Xác nhận/i }))
    expect(onConfirm).toHaveBeenCalledWith('ACTIVE', { date: TODAY, reason: 'Đã sửa xong mái' })
  })
})

describe('Pen detail (SCR-17)', () => {
  const detail = { ...existingPens[0], cattleInPen: [
    { id: 1, code: 'BC-1', situation: '', exitPending: false, hints: [{ code: 'PREGNANT', params: { expectedCalvingDate: '2027-01-15' } }] },
    { id: 2, code: 'BC-2', situation: '', exitPending: true, hints: [] },
  ] }

  it('shows the criteria version, one row per criterion and the cattle situation', () => {
    render(<BarnPanel barn={existingPens[0]} detail={detail} onEdit={vi.fn()} onToggle={vi.fn()} onMove={vi.fn()} onViewAll={vi.fn()} />)
    expect(screen.getByText('Tiêu chí nhận bò · v2 · hiệu lực từ 01/09/2026')).toBeInTheDocument()
    expect(screen.getByText('Sinh sản')).toBeInTheDocument()
    expect(screen.getByText('≥ 250 kg')).toBeInTheDocument()
    expect(screen.getByText('Mang thai · dự sinh 15/01/2027')).toBeInTheDocument()
    expect(screen.getByText('Đang chờ xuất đàn')).toBeInTheDocument()
  })

  it('moves the selected cattle', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    render(<BarnPanel barn={existingPens[0]} detail={detail} onEdit={vi.fn()} onToggle={vi.fn()} onMove={onMove} onViewAll={vi.fn()} />)
    const move = screen.getByRole('button', { name: /Chuyển các con đã chọn/ })
    expect(move).toBeDisabled()
    await user.click(screen.getByLabelText('Chọn BC-2'))
    await user.click(screen.getByRole('button', { name: /Chuyển các con đã chọn \(1\)/ }))
    expect(onMove).toHaveBeenCalledWith([expect.objectContaining({ code: 'BC-2', id: 2 })])
  })

  it('TC-04-24: Technician sees no Edit, Stop, checkbox or Move action', () => {
    render(<BarnPanel barn={existingPens[0]} detail={detail} canManage={false} onEdit={vi.fn()} onToggle={vi.fn()} onMove={vi.fn()} onViewAll={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Sửa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ngưng sử dụng/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chuyển các con đã chọn/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('Move Pen popup', () => {
  const pens: Pen[] = [
    { id: 11, code: 'A1', name: 'A1', count: 3, capacity: 10, status: 'ACTIVE', cows: [] },
    { id: 12, code: 'B1', name: 'B1', count: 1, capacity: 5, status: 'ACTIVE', cows: [] },
    { id: 13, code: 'E', name: 'E', count: 0, capacity: 5, status: 'INACTIVE', cows: [] },
  ]
  const checkResult = (overrides = {}) => ({
    destinationActive: true, freePlaces: 4, capacity: 5, headcount: 1, movingCount: 2, blocked: false, block: null,
    cattle: [
      { cattleId: 1, cattleCode: 'BC-1', currentPenCode: 'A1', currentFromDate: '2026-11-01', alreadyInDestination: false, error: null, warningReasonRequired: false,
        results: [{ criterion: 'SEX', outcome: 'MET' as const }, { criterion: 'MIN_WEIGHT_KG', outcome: 'NOT_APPLICABLE' as const }] },
      { cattleId: 2, cattleCode: 'BC-2', currentPenCode: 'A1', currentFromDate: '2026-11-01', alreadyInDestination: false, error: null, warningReasonRequired: true,
        results: [{ criterion: 'SEX', outcome: 'NOT_MET' as const }, { criterion: 'MIN_WEIGHT_KG', outcome: 'MET' as const }] },
    ],
    ...overrides,
  })
  const cattle = [{ id: 1, code: 'BC-1' }, { id: 2, code: 'BC-2' }]

  it('lists only other ACTIVE pens and requires a warning reason for the cattle that fail (TC-04-12 / 13)', async () => {
    const user = userEvent.setup()
    vi.spyOn(penApi, 'checkMove').mockResolvedValue(checkResult())
    const move = vi.spyOn(penApi, 'move').mockResolvedValue({ moved: 2, skipped: [] })
    const onMoved = vi.fn()
    render(<MoveDialog from={pens[0]} cattle={cattle} pens={pens} onClose={vi.fn()} onMoved={onMoved} today={TODAY} />)

    const destination = screen.getByRole('combobox', { name: 'Chuồng đích' })
    const options = within(destination).getAllByRole('option').map((o) => o.textContent ?? '')
    expect(options.some((o) => o.startsWith('B1'))).toBe(true)
    expect(options.some((o) => o.startsWith('A1') || o.startsWith('E '))).toBe(false)

    await user.selectOptions(destination, 'B1')
    await screen.findByText('Chuồng đích ACTIVE và còn 4 chỗ')
    expect(screen.getByText('Không đạt')).toBeInTheDocument()
    expect(screen.getAllByText('Không áp dụng').length).toBe(1)
    await user.type(screen.getAllByRole('textbox')[0], 'Ghép đàn')
    const confirm = screen.getByRole('button', { name: 'Xác nhận chuyển' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getAllByRole('textbox')[1], 'Chủ trại đồng ý')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith('Đã chuyển 2 con sang B1.'))
    expect(move).toHaveBeenCalledWith(expect.objectContaining({ moveDate: TODAY, reason: 'Ghép đàn', warningReasons: { 'BC-2': 'Chủ trại đồng ý' } }))
  })

  it('TC-04-11: blocks the move when the destination has too few places', async () => {
    const user = userEvent.setup()
    vi.spyOn(penApi, 'checkMove').mockResolvedValue(checkResult({ blocked: true, freePlaces: 1, block: { code: 'MSG-FE04-05' } }))
    render(<MoveDialog from={pens[0]} cattle={cattle} pens={pens} onClose={vi.fn()} onMoved={vi.fn()} today={TODAY} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B1')
    expect(await screen.findByText('B1 không nhận được 2 con: chuồng đã ngưng hoặc chỉ còn 1 chỗ trống.')).toBeInTheDocument()
    await user.type(screen.getAllByRole('textbox')[0], 'Ghép đàn')
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled()
  })

  it('TC-04-14: move date before the current placement or in the future is rejected', async () => {
    const user = userEvent.setup()
    vi.spyOn(penApi, 'checkMove').mockResolvedValue(checkResult())
    render(<MoveDialog from={pens[0]} cattle={cattle} pens={pens} onClose={vi.fn()} onMoved={vi.fn()} today="2026-10-31" />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B1')
    expect(await screen.findByText('Ngày chuyển phải từ 01/11/2026 đến hôm nay.')).toBeInTheDocument()
  })

  it('TC-04-18 / 19: a cattle that cannot move blocks the confirmation with its message', async () => {
    const user = userEvent.setup()
    vi.spyOn(penApi, 'checkMove').mockResolvedValue(checkResult({ cattle: [{ ...checkResult().cattle[0], error: { code: 'MSG-COM-17' } }] }))
    render(<MoveDialog from={pens[0]} cattle={[cattle[0]]} pens={pens} onClose={vi.fn()} onMoved={vi.fn()} today={TODAY} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B1')
    expect(await screen.findByText('BC-1 đang trên phiếu xuất (chết / mất tích) chờ duyệt nên không chuyển được.')).toBeInTheDocument()
    await user.type(screen.getAllByRole('textbox')[0], 'Ghép đàn')
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled()
  })
})
