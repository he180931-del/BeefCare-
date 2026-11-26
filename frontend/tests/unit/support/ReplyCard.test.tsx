import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReplyCard } from '../../../src/features/support/components/ReplyCard'
import type { Ticket } from '../../../src/features/support/types'

const ticket = { id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS', scope: 'ACCOUNT', farmId: null, farmName: null, requesterId: 1, requester: 'Chủ trại', assignedCsId: 2, assignedCs: 'CS', createdAt: '2026-11-09T10:00:00Z', updatedAt: '2026-11-09T11:00:00Z', version: 3, messagesBeforeId: null, messagesHasMore: false, messages: [], resolutions: [], history: [] } satisfies Ticket

describe('ReplyCard', () => {
  it('allows the owner to select a lightweight attachment beside the chat composer', async () => {
    const user = userEvent.setup()
    render(<ReplyCard ticket={ticket} onSend={vi.fn()} />)

    await user.upload(screen.getByLabelText('Đính kèm tệp'), new File(['proof'], 'anh-chung-tu.png', { type: 'image/png' }))
    expect(screen.getByText('anh-chung-tu.png')).toBeInTheDocument()
  })
})
