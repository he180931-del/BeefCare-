import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import CancelModal from '../../../src/features/herd-entry/components/CancelModal'

it('only previews still-valid cattle and places when another entry line was already voided', () => {
  render(<CancelModal record={{ id: 'PN-1', status: 'Đã nhập', count: 1, detail: { cows: [
    { code: 'BC-VALID', lineStatus: 'VALID', barn: 'A1' }, { code: 'BC-VOID', lineStatus: 'VOID', barn: 'A1' },
  ] } }} onClose={vi.fn()} onConfirm={vi.fn()} />)
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('row', { name: /BC-VALID/ })).toBeInTheDocument()
  expect(dialog.queryByRole('row', { name: /BC-VOID/ })).not.toBeInTheDocument()
  expect(dialog.getByText(/giải phóng/)).toHaveTextContent('giải phóng 1 chỗ')
})
