import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AttachmentList } from '../../../src/shared/ui'
it('renders accessible view/remove actions', () => { const onView = vi.fn(); const onRemove = vi.fn(); const item = { key: 'a', name: 'a.pdf', extension: 'PDF' }; render(<AttachmentList items={[item]} onView={onView} onRemove={onRemove} />); fireEvent.click(screen.getByRole('button', { name: 'Xem a.pdf' })); fireEvent.click(screen.getByRole('button', { name: 'Xóa a.pdf' })); expect(onView).toHaveBeenCalledWith('a'); expect(onRemove).toHaveBeenCalledWith('a') })
