import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { OperationalScreen } from '../../../src/features/operations/pages/OperationalScreens'

describe('OperationalScreen', () => {
  it('renders one filter toolbar and one flat worklist', () => {
    render(<OperationalScreen screen={screenById('SCR-46')!} state="success" role="manager" />)
    expect(screen.getByRole('heading', { name: 'Lịch tiêm phòng' })).toBeInTheDocument()
    expect(screen.getAllByRole('search')).toHaveLength(1)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Sắp đến hạn')).toBeInTheDocument()
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
})
