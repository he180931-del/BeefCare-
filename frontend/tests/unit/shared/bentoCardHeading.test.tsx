import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, Card, Panel } from '../../../src/shared/ui'

/** Bento blocks side by side on one screen share one title size and padding (docs/BeefCare-Bento-Grid.md §2–3). */
describe('Bento card titles', () => {
  it('a Bento card has the same 18 px h2 title and 16/24 px padding as a Panel', () => {
    render(<>
      <Card variant="panel" title="Trao đổi"><p>Nội dung</p></Card>
      <Panel title="Kết quả giải quyết"><p>Nội dung</p></Panel>
    </>)
    const card = screen.getByRole('heading', { level: 2, name: 'Trao đổi' })
    const panel = screen.getByRole('heading', { level: 2, name: 'Kết quả giải quyết' })
    expect(card.className).toBe(panel.className)
    expect(card).toHaveClass('text-lg', 'font-bold')
    expect(card.closest('section')).toHaveClass('rounded-2xl', 'border-field', 'p-4', '@min-[1024px]:p-6')
    expect(card.closest('section')).toHaveAccessibleName('Trao đổi')
  })

  it('a card nested in another card uses an h3 title of 16 px', () => {
    render(<Card variant="panel" title="Đăng ký gói dịch vụ"><Card variant="panel" headingAs="h3" title="Điều khoản gói"><p>…</p></Card></Card>)
    expect(screen.getByRole('heading', { level: 2, name: 'Đăng ký gói dịch vụ' })).toHaveClass('text-lg')
    expect(screen.getByRole('heading', { level: 3, name: 'Điều khoản gói' })).toHaveClass('text-base')
  })

  it('the sub line and the actions of a Bento card stay together at the top', () => {
    render(<Card variant="panel" title="Lịch sử phiếu" sub="Giờ Việt Nam (UTC+7)" actions={<><Badge>Đã ghi sổ</Badge><Badge>v2</Badge></>}><p>…</p></Card>)
    expect(screen.getByRole('heading', { name: 'Lịch sử phiếu' })).not.toHaveTextContent('UTC+7')
    expect(screen.getByText('Giờ Việt Nam (UTC+7)')).toBeInTheDocument()
    // Both badges sit in one wrapper, so the header row does not spread them apart.
    expect(screen.getByText('Đã ghi sổ').parentElement).toBe(screen.getByText('v2').parentElement)
  })

  it('a plain card outside Bento screens keeps its old 14 px h3 title', () => {
    render(<Card title="Danh sách"><p>…</p></Card>)
    expect(screen.getByRole('heading', { level: 3, name: 'Danh sách' })).toHaveClass('text-sm')
  })
})
