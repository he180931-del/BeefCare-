import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, ErrorBlock, Note, Panel } from '../../../src/shared/ui'

/** Tab 13 review (23/11): page actions on Bento screens share one button size instead of per-page class overrides. */
describe('Bento button size and notes on dark panels', () => {
  it('size="bento" gives a 44 px touch target, 8 px corners and lets a long label wrap', () => {
    render(<Button size="bento">Thanh toán để kích hoạt</Button>)
    const button = screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })
    expect(button).toHaveClass('min-h-11', 'rounded-lg', 'whitespace-normal', 'border-field')
    expect(button).not.toHaveClass('whitespace-nowrap')
    expect(button).not.toHaveClass('rounded')
  })

  it('the default, small and dialog sizes still keep their label on one line', () => {
    render(<><Button>Mặc định</Button><Button size="sm">Nhỏ</Button><Button size="lg">Hộp thoại</Button></>)
    for (const name of ['Mặc định', 'Nhỏ', 'Hộp thoại']) expect(screen.getByRole('button', { name })).toHaveClass('whitespace-nowrap')
    expect(screen.getByRole('button', { name: 'Hộp thoại' })).toHaveClass('h-[46px]', 'rounded-xl')
  })

  it('the retry button of a Bento error block uses the same size', () => {
    render(<ErrorBlock variant="panel" message="Không tải được" onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Thử lại' })).toHaveClass('min-h-11', 'rounded-lg')
  })

  it('a grey note sets its own dark text, so it stays readable inside the dark emphasis panel', () => {
    render(<Panel tone="emphasis" title="Kết quả"><Note>Xác nhận không tự đóng yêu cầu.</Note></Panel>)
    expect(screen.getByText('Xác nhận không tự đóng yêu cầu.')).toHaveClass('bg-chip', 'text-ink')
  })
})
