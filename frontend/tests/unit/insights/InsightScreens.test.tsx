import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { InsightScreen } from '../../../src/features/insights/pages/InsightScreens'

describe('InsightScreen', () => {
  it('renders one summary band, labeled period and textual totals', () => {
    render(<InsightScreen screen={screenById('SCR-77')!} state="success" />)
    expect(screen.getByLabelText('Khoảng theo dõi')).toBeInTheDocument()
    expect(screen.getByText('328 con')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cần chú ý hôm nay' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cơ cấu đàn' })).toBeInTheDocument()
    expect(screen.getByText('M09 · Sinh sản')).toBeInTheDocument()
    expect(screen.getByText('Tính lúc 06:30 · 03/11/2026', { exact: false })).toBeInTheDocument()
  })

  it('renders report criteria, catalogue and result semantics for SCR-78', () => {
    render(<InsightScreen screen={screenById('SCR-78')!} state="success" />)
    expect(screen.getByLabelText('Loại báo cáo')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /RPT-07 · Hiệu quả vỗ béo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem báo cáo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kết quả báo cáo' })).toBeInTheDocument()
    expect(screen.getByText('Tổng cộng')).toBeInTheDocument()
    expect(screen.getByText('Không đủ dữ liệu (3 con)')).toBeInTheDocument()
  })

  it('gives each empty insight screen its own recovery guidance', () => {
    const { rerender } = render(<InsightScreen screen={screenById('SCR-77')!} state="empty" />)
    expect(screen.getByText('Trang trại chưa có dữ liệu tổng quan')).toBeInTheDocument()
    rerender(<InsightScreen screen={screenById('SCR-78')!} state="empty" />)
    expect(screen.getByText('Chưa có kết quả báo cáo')).toBeInTheDocument()
  })
})
