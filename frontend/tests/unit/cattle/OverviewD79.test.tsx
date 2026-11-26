import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mapBackendCattle } from '../../../src/features/cattle/api/cattleMapper'
import OverviewTab, { purposeLabel } from '../../../src/features/cattle/components/OverviewTab'
import { cowDesc } from '../../../src/features/cattle/components/CowHeader'

// D79: tab Tổng quan của hồ sơ bò – ô tóm tắt mở tab, thông tin cá thể gọn, Lịch sử chuồng và Thẻ QR là khối gập.
const cow = (patch: Record<string, unknown> = {}) => mapBackendCattle(
  {
    id: 7, displayCode: 'BC-007', herdStatus: 'ACTIVE', sex: 'FEMALE', breedName: 'Lai Sind', earTagNumber: 'VN-07',
    birthDate: '2023-03-01', penCode: 'B1', reproductiveStatus: 'PREGNANT', latestWeightKg: 342, vaccinationOverdue: 1, ...patch,
  },
  { current: { penCode: 'B1', since: '2026-09-01' }, history: [{ fromDate: '2026-09-01', penCode: 'B1', reason: 'Phân chuồng' }] },
  [{ tagCode: 'QR-7', status: 'ACTIVE', issuedAt: '2026-09-02T01:00:00Z' }],
  [], {}, '2026-11-26',
)
const renderOverview = (props: Partial<Parameters<typeof OverviewTab>[0]> = {}) =>
  render(<MemoryRouter><OverviewTab cow={cow()} canWrite={false} onOpenModal={vi.fn()} {...props} /></MemoryRouter>)

describe('Tóm tắt chăm sóc mở tab chi tiết', () => {
  it.each([
    ['Cân gần nhất', 'growth'],
    ['Sức khỏe', 'health'],
    ['Sinh sản', 'repro'],
    ['Tiêm phòng', 'vaccine'],
    ['Cách ly thịt', 'health'],
  ])('%s → tab %s', async (label, tab) => {
    const onTab = vi.fn()
    renderOverview({ onTab })
    await userEvent.setup().click(screen.getByRole('button', { name: `${label}: mở tab chi tiết` }))
    expect(onTab).toHaveBeenCalledWith(tab)
  })

  it('ô Sinh sản của bò đực chỉ là chữ, không mở tab ẩn', () => {
    render(<MemoryRouter><OverviewTab cow={cow({ sex: 'MALE', reproductiveStatus: 'NOT_APPLICABLE' })} canWrite={false} onOpenModal={vi.fn()} onTab={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Sinh sản: mở tab chi tiết' })).not.toBeInTheDocument()
    expect(screen.getByText('Không áp dụng')).toBeInTheDocument()
  })

  it('ô Tiêm phòng hiện số mũi quá hạn từ backend', () => {
    renderOverview({ onTab: vi.fn() })
    expect(within(screen.getByRole('button', { name: 'Tiêm phòng: mở tab chi tiết' })).getByText('1 mũi quá hạn')).toBeInTheDocument()
  })
})

describe('Thông tin cá thể gọn', () => {
  it('luôn hiện trường hay hỏi, định danh và nguồn gốc nằm sau "Xem thêm"', async () => {
    renderOverview()
    expect(screen.getByText('Giống')).toBeInTheDocument()
    expect(screen.getByText('Mục đích nuôi')).toBeInTheDocument()
    // Chuồng hiện tại chỉ ở tiêu đề và dòng tóm tắt Lịch sử chuồng.
    expect(screen.queryByText('Chuồng hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Số thẻ tai')).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: /^Xem thêm/ })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.setup().click(more)
    expect(screen.getByText('Số thẻ tai')).toBeInTheDocument()
    expect(screen.getByText('VN-07')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Không lặp, không "—" thừa (soát trên dữ liệu thật)', () => {
  it('mục đích trùng tên loại thì không viết "Vỗ béo (Vỗ béo)"', () => {
    expect(purposeLabel({ ...cow(), purpose: 'Vỗ béo', purposeType: 'FATTENING', purposeSince: '01/08/2026' })).toBe('Vỗ béo · từ 01/08/2026')
    expect(purposeLabel({ ...cow(), purpose: 'Bò thịt cao cấp', purposeType: 'FATTENING', purposeSince: '01/08/2026' })).toBe('Bò thịt cao cấp (Vỗ béo) · từ 01/08/2026')
  })

  it('tiêu đề không chèn "—" khi không rõ tuổi', () => {
    const desc = cowDesc(cow({ birthDate: null, birthDateAccuracy: 'UNKNOWN' }))
    expect(desc).not.toContain('—')
    expect(desc).toContain('Lai Sind · Cái · Chuồng B1')
  })

  it('bò ngoài diện sinh sản không có huy hiệu "Không áp dụng"', () => {
    const badges = cow({ sex: 'MALE', reproductiveStatus: 'NOT_APPLICABLE' }).headerBadges.map(([label]) => label)
    expect(badges).not.toContain('Không áp dụng')
    expect(cow().headerBadges.map(([label]) => label)).toContain('Mang thai')
  })
})

describe('Lịch sử chuồng và Thẻ QR là khối gập', () => {
  it('gập sẵn, dòng tóm tắt trả lời ngay chuồng và thẻ hiện tại', () => {
    renderOverview()
    expect(screen.getByRole('button', { name: 'Lịch sử chuồng' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Thẻ QR' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/^B1 · từ 01\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/^QR-7 · cấp/)).toBeInTheDocument()
    expect(screen.queryByText('Lịch sử phân chuồng')).not.toBeInTheDocument()
  })

  it('bấm tiêu đề thì mở nội dung', async () => {
    renderOverview()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lịch sử chuồng' }))
    expect(screen.getByText('Lịch sử phân chuồng')).toBeInTheDocument()
  })

  it.each([['barns', 'Lịch sử chuồng', 'Lịch sử phân chuồng'], ['qr', 'Thẻ QR', 'Lịch sử thẻ']] as const)(
    'liên kết cũ ?tab=%s mở sẵn khối %s',
    (section, title, content) => {
      renderOverview({ openSection: section })
      expect(screen.getByRole('button', { name: title })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText(content)).toBeInTheDocument()
    },
  )
})
