import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { reproductionApi, resetReproductionDemo } from '../../../src/features/reproduction/api/reproductionApi'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'
import ReproductionTechnicianTab from '../../../src/features/reproduction/components/ReproductionTechnicianTab'
import CalvingPage from '../../../src/features/reproduction/pages/CalvingPage'
import TechnicianProfile from '../../../src/features/cattle/components/TechnicianProfile'
import { SessionContext } from '../../../src/features/authorization/sessionContext'

const technician = { role: 'TECHNICIAN' as const, fullName: 'Lê Thị Mai', email: 'mai@x.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => undefined }
const profileAt = (code: string, role: 'MANAGER' | 'OWNER' | 'TECHNICIAN' = 'MANAGER') =>
  render(<MemoryRouter initialEntries={[`/cattle/${code}?tab=repro`]}><ReproductionProfileTab cattleCode={code} role={role} /></MemoryRouter>)

beforeEach(async () => { await resetReproductionDemo() })

describe('profile tab: estrus female (frame 2616:4352)', () => {
  it('shows the status card with record buttons, indicators note, eligibility, window and timeline', async () => {
    const user = userEvent.setup()
    profileAt('BC-000142')
    expect(await screen.findByText('Số lần phối (chu kỳ này)')).toBeInTheDocument()
    expect(screen.getByText('236 kg · thực tế')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghi động dục' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghi phối giống' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi sự kiện đẻ' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(screen.getByRole('menuitem', { name: 'Ghi khám thai' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Ghi sự kiện đẻ/ })).toBeInTheDocument()

    expect(screen.getByText('Chưa có chỉ số sinh sản: bò chưa đẻ lứa nào.')).toBeInTheDocument()
    expect(screen.getByText('Điều kiện xét phối')).toBeInTheDocument()
    expect(screen.getByText('Đạt 3/3')).toBeInTheDocument()
    expect(screen.getByText('Tuổi ≥ 13 tháng')).toBeInTheDocument()
    expect(screen.getByText('Cân ≥ 230 kg')).toBeInTheDocument()
    expect(screen.getByText('Cửa sổ phối gợi ý')).toBeInTheDocument()
    expect(screen.getByText(/14:30 – 18:30/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sửa 19/10/2026 18:10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy 22/09/2026 07:00' })).toBeInTheDocument()
  })

  it('opens the correct dialog from a timeline row and marks the row as edited after saving', async () => {
    const user = userEvent.setup()
    profileAt('BC-000142')
    await user.click(await screen.findByRole('button', { name: 'Sửa 19/10/2026 18:10' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa / hủy bản ghi động dục' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), ', kêu rống')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Bổ sung dấu hiệu')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu chỉnh sửa' }))
    expect(await screen.findByText('Đã sửa')).toBeInTheDocument()
    expect(screen.getByText('Bồn chồn, nhảy lên con khác, kêu rống')).toBeInTheDocument()
  })

  it('gives the owner a read-only tab without record buttons or row actions', async () => {
    profileAt('BC-000142', 'OWNER')
    await screen.findByText('Số lần phối (chu kỳ này)')
    expect(screen.queryByRole('button', { name: 'Ghi động dục' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Sửa / })).not.toBeInTheDocument()
  })
})

describe('profile tab: pregnant female (frame 2617:10399)', () => {
  it('shows the current pregnancy, calf history, indicator strip and a primary calving button', async () => {
    const user = userEvent.setup()
    profileAt('BC-000087')
    expect(await screen.findByText('Thai kỳ hiện tại')).toBeInTheDocument()
    expect(screen.getByText('22/10/2026 · đã xác nhận')).toBeInTheDocument()
    expect(screen.getByText('12/01/2026 · TTNT · BRD-204')).toBeInTheDocument()
    expect(screen.getByText('Ngày phối + 283 ngày')).toBeInTheDocument()
    expect(screen.getByText('Lịch sử sinh bê')).toBeInTheDocument()
    expect(screen.getByText('Bê 1: Sống · Cái · 22 kg')).toBeInTheDocument()
    expect(screen.getByText('Tuổi đẻ lứa đầu')).toBeInTheDocument()
    expect(screen.getByText('3 lần đậu / 5 lần phối')).toBeInTheDocument()
    for (const label of ['Ghi khám thai', 'Ghi diễn biến thai', 'Ghi sự kiện đẻ']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Loại sự kiện' }), 'PREGNANCY_CHECK')
    expect(screen.getAllByText('Khám thai').length).toBeGreaterThan(1)
    expect(screen.queryByText('Biến chứng · Phù chân sau, đi lại chậm · ca HC-0415')).not.toBeInTheDocument()
  })
})

describe('calving page (frames 2617:10907, 2617:11217)', () => {
  const calvingAt = (role: 'MANAGER' | 'OWNER' = 'MANAGER') => render(
    <MemoryRouter initialEntries={['/cattle/BC-000087/sinh-san/de']}>
      <Routes>
        <Route path="/cattle/:code/sinh-san/de" element={<CalvingPage role={role} />} />
        <Route path="/cattle/:code" element={<h1>Hồ sơ bò</h1>} />
      </Routes>
    </MemoryRouter>,
  )

  it('lays the page out like the frame and links back to the profile', async () => {
    calvingAt()
    expect(await screen.findByRole('heading', { name: 'Ghi sự kiện đẻ' })).toBeInTheDocument()
    expect(screen.getByText('BC-000087 “Mận” · Lai Sind · Chuồng D – Chuồng đẻ · thai kỳ 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quay lại hồ sơ' })).toHaveAttribute('href', '/cattle/BC-000087?tab=repro')
    expect(screen.getByText('Kết quả bê (1)')).toBeInTheDocument()
    expect(screen.getByLabelText('Bò mẹ')).toHaveValue('BC-000087 · Số tai 0087 · Lai Sind · D')
    expect(screen.getByRole('radio', { name: 'Có – gợi ý mở ca sức khỏe' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Can thiệp' })).toBeInTheDocument()
  })

  it('shows the red duplicate-tag error on the field, keeps the typed values, then saves and updates the profile', async () => {
    const user = userEvent.setup()
    calvingAt()
    const group = await screen.findByRole('group', { name: 'Bê số 1' })
    await user.click(within(group).getByRole('radio', { name: 'Đăng ký ngay' }))
    const tag = within(group).getByRole('textbox', { name: 'Mã thẻ tai / QR' })
    await user.type(tag, 'QR-6701-0001')
    fireEvent.change(within(group).getByRole('spinbutton', { name: 'Cân sơ sinh' }), { target: { value: '24' } })
    await user.click(within(group).getByRole('radio', { name: 'Cân thực tế' }))
    await user.click(screen.getByRole('button', { name: 'Lưu sự kiện đẻ' }))

    expect(await screen.findByText('Chưa lưu được: mã thẻ tai của Bê số 1 đã được dùng. Sửa ô được đánh dấu đỏ rồi lưu lại.')).toBeInTheDocument()
    expect(tag).toHaveAttribute('aria-invalid', 'true')
    expect(tag).toHaveValue('QR-6701-0001')
    expect(within(group).getByText('Mã QR-6701-0001 đã dùng cho bò BC-000112')).toHaveClass('text-err-fg')
    expect(within(group).getByRole('spinbutton', { name: 'Cân sơ sinh' })).toHaveValue(24)
    expect((await reproductionApi.getProfile('BC-000087')).status).toBe('PREGNANT')

    await user.clear(tag)
    await user.type(tag, 'QR-6701-0249')
    await user.click(screen.getByRole('button', { name: 'Lưu sự kiện đẻ' }))
    expect(await screen.findByRole('heading', { name: 'Hồ sơ bò' })).toBeInTheDocument()
    const saved = await reproductionApi.getProfile('BC-000087')
    expect(saved.status).toBe('POST_CALVING')
    expect(saved.calvings[0]?.calves[0]).toMatchObject({ earTag: 'QR-6701-0249', weightKg: 24, registrationStatus: 'REGISTERED' })

    render(<MemoryRouter><ReproductionProfileTab cattleCode="BC-000087" role="MANAGER" /></MemoryRouter>)
    expect(await screen.findAllByText('Lịch sử sinh bê')).not.toHaveLength(0)
    expect(screen.getAllByText(/QR-6701-0249/).length).toBeGreaterThan(0)
  })

  it('blocks a weight without a basis on the weight field and adds, limits and removes calf blocks', async () => {
    const user = userEvent.setup()
    calvingAt()
    const first = await screen.findByRole('group', { name: 'Bê số 1' })
    fireEvent.change(within(first).getByRole('spinbutton', { name: 'Cân sơ sinh' }), { target: { value: '26.5' } })
    await user.click(screen.getByRole('button', { name: 'Lưu sự kiện đẻ' }))
    expect(await within(first).findByText('Bê số 1: chọn cơ sở cân.')).toBeInTheDocument()

    for (let i = 0; i < 5; i += 1) await user.click(screen.getByRole('button', { name: 'Thêm bê' }))
    expect(screen.getAllByRole('group', { name: /^Bê số / })).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Thêm bê' })).toBeDisabled()
    await user.click(within(screen.getByRole('group', { name: 'Bê số 4' })).getByRole('button', { name: 'Xóa bê' }))
    expect(screen.getAllByRole('group', { name: /^Bê số / })).toHaveLength(3)
  })

  it('stays read-only for the owner', async () => {
    calvingAt('OWNER')
    await screen.findByRole('heading', { name: 'Ghi sự kiện đẻ' })
    expect(screen.getByText('Chỉ Quản lý được ghi sự kiện đẻ. Chủ trại và Kỹ thuật viên xem ở chế độ chỉ đọc.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu sự kiện đẻ' })).toBeDisabled()
  })
})

describe('technician tab (frames 2617:12112, 2617:12205)', () => {
  it('computes the breeding condition from the real rule and links "Xem tất cả" to the timeline tab', async () => {
    render(<MemoryRouter><ReproductionTechnicianTab cattleCode="BC-000142" /></MemoryRouter>)
    expect(await screen.findByText('Điều kiện phối')).toBeInTheDocument()
    expect(screen.getByText('Đạt 3/3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute('href', '/kt/dan-bo/BC-000142?tab=timeline')
  })

  it('shows a failed condition instead of a fixed pass', async () => {
    render(<MemoryRouter><ReproductionTechnicianTab cattleCode="BC-000188" /></MemoryRouter>)
    expect(await screen.findByText('Chưa đạt 2/3')).toBeInTheDocument()
    expect(screen.queryByText('Đạt 3/3')).not.toBeInTheDocument()
  })

  it('shows the pregnancy card and calf history for a pregnant cow', async () => {
    render(<MemoryRouter><ReproductionTechnicianTab cattleCode="BC-000087" /></MemoryRouter>)
    expect(await screen.findByText('Thai kỳ lần 3')).toBeInTheDocument()
    expect(screen.getByText('LỊCH SỬ SINH BÊ')).toBeInTheDocument()
    expect(screen.getByText('Bê 1: Sống · Cái · 22 kg · BC-000171')).toBeInTheDocument()
  })

  it('opens the Sinh sản tab of the technician profile from ?tab=repro', async () => {
    render(
      <SessionContext.Provider value={technician}>
        <MemoryRouter initialEntries={['/kt/dan-bo/BC-000142?tab=repro']}>
          <Routes><Route path="/kt/dan-bo/:code" element={<TechnicianProfile />} /></Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )
    expect(await screen.findByText('Cửa sổ phối gợi ý')).toBeInTheDocument()
    expect(screen.getByText('DÒNG THỜI GIAN SINH SẢN')).toBeInTheDocument()
  })
})
