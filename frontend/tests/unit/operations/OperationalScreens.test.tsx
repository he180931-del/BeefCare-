import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { OperationalScreen } from '../../../src/features/operations/pages/OperationalScreens'

describe('OperationalScreen', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders one filter toolbar and one flat worklist', () => {
    render(<OperationalScreen screen={screenById('SCR-46')!} state="success" role="manager" />)
    expect(screen.getByRole('heading', { name: 'Lịch tiêm phòng' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Sắp đến hạn').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Phân trang bảng')).toHaveTextContent(/\/ 100 dòng/)
    expect(screen.getByRole('button', { name: 'Trang 4' })).toBeInTheDocument()
  })

  it('keeps a useful empty state inside the worklist', () => {
    render(<OperationalScreen screen={screenById('SCR-53')!} state="empty" role="owner" />)
    expect(screen.getByText('Chưa có ca bệnh phù hợp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở ca bệnh' })).toBeInTheDocument()
  })

  it('does not show mutation actions to a read-only review state', () => {
    render(<OperationalScreen screen={screenById('SCR-59')!} state="read-only" role="technician" />)
    expect(screen.queryByRole('button', { name: 'Ghi nhận mới' })).not.toBeInTheDocument()
  })

  it('opens details and saves a new local operational record', () => {
    render(<OperationalScreen screen={screenById('SCR-53')!} state="success" role="manager" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở ca bệnh' }))
    fireEvent.change(screen.getByLabelText('Bò / triệu chứng'), { target: { value: 'VN-0401 · Sốt nhẹ' } })
    fireEvent.change(screen.getByLabelText('Thông tin chi tiết'), { target: { value: 'Chuồng C2 · theo dõi trong 48 giờ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    expect(screen.getByText(/Đã lưu HE-004 trong dữ liệu cục bộ/)).toBeInTheDocument()
    expect(window.localStorage.getItem('beefcare-operational-preview.v1')).toContain('VN-0401')
  })
})
