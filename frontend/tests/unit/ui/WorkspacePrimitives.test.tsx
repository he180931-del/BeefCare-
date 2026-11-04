import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, FixtureNotice, StickyActions, WorkSection } from '../../../src/components/workspace'

describe('workspace primitives', () => {
  it('uses a flat section hierarchy instead of a decorative card', () => {
    render(<WorkSection title="Danh sách bò">Nội dung</WorkSection>)
    const section = screen.getByRole('region', { name: 'Danh sách bò' })
    expect(section.className).not.toMatch(/rounded|shadow|border-edge/)
  })

  it('marks temporary fixture data clearly', () => {
    render(<FixtureNotice />)
    expect(screen.getByText('Dữ liệu minh họa · chưa lưu')).toBeInTheDocument()
  })

  it('puts warnings before the sticky action group', () => {
    render(<StickyActions message="Còn 2 trường cần nhập" actions={<button>Lưu</button>} />)
    const content = screen.getByText('Còn 2 trường cần nhập')
    const action = screen.getByRole('button', { name: 'Lưu' })
    expect(content.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers one explicit recovery action in an empty state', () => {
    const onAction = vi.fn()
    render(<EmptyState title="Chưa có dữ liệu" actionLabel="Tạo bản ghi" onAction={onAction} />)
    expect(screen.getByRole('button', { name: 'Tạo bản ghi' })).toBeInTheDocument()
  })
})
