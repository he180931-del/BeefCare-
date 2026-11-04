import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { PlatformScreen } from '../../../src/features/platform/pages/PlatformScreens'

describe('PlatformScreen', () => {
  it('keeps support and reconciliation in the BeefCare visual language', () => {
    render(<PlatformScreen screen={screenById('SCR-91')!} state="success" role="pm" />)
    expect(screen.getByRole('heading', { name: 'Thanh toán và đối soát' })).toBeInTheDocument()
    expect(screen.getByText('Chờ đối soát')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it.each([
    ['SCR-20', 'Tài khoản người dùng', 'Trang trại tham gia', 'Tạm ngừng tài khoản'],
    ['SCR-21', 'Quyền nhân sự nền tảng', 'SA hoạt động cuối cùng', 'Lịch sử quyền'],
    ['SCR-80', 'Lịch sử kiểm tra', 'Mã tương quan', 'Chỉ hiển thị trường được phép'],
  ])('renders a dedicated platform workbench for %s', (id, heading, firstMarker, secondMarker) => {
    render(<PlatformScreen screen={screenById(id as `SCR-${string}`)!} state="success" role="sa" />)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getAllByText(firstMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(secondMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
  })

  it('removes account status actions in read-only review state', () => {
    render(<PlatformScreen screen={screenById('SCR-20')!} state="read-only" role="sa" />)
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạm ngừng tài khoản' })).not.toBeInTheDocument()
  })

  it('shows contextual audit empty guidance', () => {
    render(<PlatformScreen screen={screenById('SCR-80')!} state="empty" role="sa" />)
    expect(screen.getByText('Chưa có bản ghi audit trong khoảng đã chọn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt lại 7 ngày gần nhất' })).toBeInTheDocument()
  })
})
