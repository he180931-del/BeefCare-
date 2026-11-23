import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LegalDialog } from '../../../src/features/authentication/components/LegalDialog'
import type { LegalKind } from '../../../src/features/authentication/domain/legalContent'

function Harness({ initialKind = 'terms', onConfirm }: { initialKind?: LegalKind; onConfirm?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(true)
  const trigger = createRef<HTMLButtonElement>()
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)}>Mở chính sách</button>
    {open ? <LegalDialog initialKind={initialKind} onClose={() => setOpen(false)} onConfirm={onConfirm} returnFocusRef={trigger} /> : null}
  </>
}

describe('LegalDialog', () => {
  it('renders the selected document and switches tabs without closing', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByRole('tab', { name: 'Điều khoản sử dụng' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '1. Tài khoản và đăng ký' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Chính sách dữ liệu' }))
    expect(screen.getByRole('tab', { name: 'Chính sách dữ liệu' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '3. Dữ liệu vận hành đàn' })).toBeInTheDocument()
    expect(screen.queryByText(/SRS 28\/10\/2026/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Nguồn:/)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('requires an explicit checkbox before confirming consent', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness initialKind="policy" onConfirm={onConfirm} />)

    expect(screen.getByRole('button', { name: 'Đồng ý và xác nhận' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Đồng ý và xác nhận' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('closes from the close control and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness initialKind="policy" />)

    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở chính sách' })).toHaveFocus()
  })

  it('marks the document body as the independent scroll region', () => {
    render(<Harness />)
    expect(screen.getByTestId('legal-scroll-region')).toHaveClass('overflow-y-auto')
  })
})
