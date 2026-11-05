import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { RecordScreen } from '../../../src/features/records/pages/RecordScreens'

describe('RecordScreen', () => {
  it('shows compact identity, status and parent information', () => {
    render(<RecordScreen screen={screenById('SCR-27')!} state="success" />)
    expect(screen.getByRole('heading', { name: 'VN-0248 · Bò cái 248' })).toBeInTheDocument()
    expect(screen.getByText('Mẹ: VN-0102')).toBeInTheDocument()
    expect(screen.getByText('Đang nuôi')).toBeInTheDocument()
  })

  it('keeps timeline events in newest-first order without card soup', () => {
    const { container } = render(<RecordScreen screen={screenById('SCR-79')!} state="success" />)
    const times = screen.getAllByRole('time').map((element) => element.getAttribute('datetime'))
    expect(times).toEqual(['2026-11-02', '2026-10-28', '2026-10-20'])
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(0)
  })

  it('switches record sections and saves a local profile update', () => {
    render(<RecordScreen screen={screenById('SCR-27')!} state="success" />)

    fireEvent.click(screen.getByRole('button', { name: 'Sinh sản' }))
    expect(screen.getByRole('heading', { name: 'Sinh sản' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    expect(screen.getByRole('heading', { name: 'Cập nhật hồ sơ bò' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tên gọi *'), { target: { value: 'Bò cái Nâu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(screen.getByRole('heading', { name: 'VN-0248 · Bò cái Nâu' })).toBeInTheDocument()
    expect(screen.getByText('Đã lưu thay đổi cục bộ.')).toBeInTheDocument()
  })
})
