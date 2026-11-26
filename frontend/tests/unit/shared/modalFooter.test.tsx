import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Modal, ModalButton, ModalFooter } from '../../../src/shared/ui'

/**
 * 23/11: the footer used to add its own 24 px side/bottom padding inside the already padded dialog, so actions sat 24 px
 * in from the content edge with 48 px below them; about 40 dialogs patched it back with `!px-0 !pb-0`. The dialog now owns
 * the inset and the footer only lays out the actions (Figma: actions flush with the content, 16 px below it).
 */
function renderDialog() {
  return render(
    <MemoryRouter>
      <Modal title="Hủy phiếu nhập PN-2026-0011" onClose={vi.fn()}>
        <p>Lý do hủy</p>
        <ModalFooter>
          <ModalButton>Quay lại</ModalButton>
          <ModalButton variant="danger">Hủy phiếu nhập và hoàn lại toàn bộ khoản đã thanh toán</ModalButton>
        </ModalFooter>
      </Modal>
    </MemoryRouter>,
  )
}

describe('ModalFooter inside the shared dialog', () => {
  it('renders a supplied footer outside the scrollable body', () => {
    render(
      <MemoryRouter>
        <Modal title="Chọn bò" onClose={vi.fn()} footer={<ModalFooter><ModalButton>Đóng</ModalButton></ModalFooter>}>
          <p>Nội dung dài</p>
        </Modal>
      </MemoryRouter>,
    )
    const body = screen.getByText('Nội dung dài').parentElement?.parentElement as HTMLElement
    const closeButtons = screen.getAllByRole('button', { name: 'Đóng' })
    const footer = closeButtons.slice(-1)[0].parentElement as HTMLElement
    expect(body).toContainElement(screen.getByText('Nội dung dài'))
    expect(body).not.toContainElement(closeButtons[0])
    expect(footer.parentElement).toHaveClass('mt-4', 'shrink-0')
  })

  it('adds no padding of its own; the dialog keeps the 24 px inset and the safe area at the bottom', () => {
    renderDialog()
    const footer = screen.getByRole('button', { name: 'Quay lại' }).parentElement as HTMLElement
    expect(footer.className).not.toMatch(/(^|\s)!?p[xytb]?-|(^|\s)p[xytb]?-[^\s]*!/)
    expect(footer).toHaveClass('justify-end', 'gap-2.5')
    expect(screen.getByRole('dialog')).toHaveClass('p-6', 'pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]')
  })

  it('gives every action at least 46 px and lets a long label wrap instead of overflowing the dialog', () => {
    renderDialog()
    const footer = screen.getByRole('button', { name: 'Quay lại' }).parentElement as HTMLElement
    expect(footer).toHaveClass('[&_button]:min-h-[46px]', '[&_button]:whitespace-normal', '[&_button]:h-auto', '[&>*]:min-w-0')
    // The label stays one readable string for assistive technology even when it wraps visually.
    expect(screen.getByRole('button', { name: 'Hủy phiếu nhập và hoàn lại toàn bộ khoản đã thanh toán' })).toBeInTheDocument()
  })

  it('draws a visible focus ring inside each action, in the text colour of that button', () => {
    renderDialog()
    const footer = screen.getByRole('button', { name: 'Quay lại' }).parentElement as HTMLElement
    expect(footer).toHaveClass('[&_button]:focus-visible:outline-2', '[&_button]:focus-visible:outline-offset-[-3px]', '[&_button]:focus-visible:outline-current')
  })
})
