import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { InsightScreen } from '../../../src/features/insights/pages/InsightScreens'

describe('InsightScreen', () => {
  it('renders one summary band, labeled period and textual totals', () => {
    render(<InsightScreen screen={screenById('SCR-77')!} state="success" />)
    expect(screen.getByLabelText('Khoảng theo dõi')).toBeInTheDocument()
    expect(screen.getByLabelText('Giai đoạn sinh trưởng')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cần chú ý hôm nay' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cơ cấu đàn' })).toBeInTheDocument()
    expect(screen.getByText('M09 · Sinh sản')).toBeInTheDocument()
    expect(screen.getByText(/bò đang nuôi · Dịch vụ:/)).toBeInTheDocument()
  })

  it('renders report criteria, catalogue and result semantics for SCR-78', () => {
    render(<InsightScreen screen={screenById('SCR-78')!} state="success" />)
    expect(screen.getByLabelText('Loại báo cáo')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /RPT-07 · Hiệu quả vỗ béo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem báo cáo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kết quả · Hiệu quả vỗ béo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Biểu đồ Chi phí thức ăn/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tử số / mẫu số · chi tiết' })).toBeInTheDocument()
    expect(screen.getByText('Tổng')).toBeInTheDocument()
  })

  it('gives each empty insight screen its own recovery guidance', () => {
    const { rerender } = render(<InsightScreen screen={screenById('SCR-77')!} state="empty" />)
    expect(screen.getByText('Trang trại chưa có dữ liệu tổng quan')).toBeInTheDocument()
    rerender(<InsightScreen screen={screenById('SCR-78')!} state="empty" />)
    expect(screen.getByText('Chưa có kết quả báo cáo')).toBeInTheDocument()
  })
})
