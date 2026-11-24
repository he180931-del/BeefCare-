import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConversationCard } from '../../../src/features/support/components/ConversationCard'
import type { Ticket } from '../../../src/features/support/types'

const ticket: Ticket = {
  id: 9,
  code: 'TK-0009',
  subject: 'Cần hỗ trợ',
  category: 'OTHER',
  priority: 'NORMAL',
  status: 'IN_PROGRESS',
  scope: 'ACCOUNT',
  farmId: null,
  farmName: null,
  requesterId: 1,
  requester: 'Chủ trại',
  assignedCsId: 2,
  assignedCs: 'CS',
  createdAt: '2026-11-09T10:00:00Z',
  updatedAt: '2026-11-09T11:00:00Z',
  version: 3,
  messagesBeforeId: 41,
  messagesHasMore: true,
  messages: [{ id: 41, code: 'REPLY', params: {}, text: 'Tin mới', kind: 'REPLY', author: 'CS', authorRole: 'CS', createdAt: '2026-11-09T11:00:00Z' }],
  resolutions: [],
  history: [],
}

describe('ConversationCard', () => {
  it('renders the supplied reply composer at the bottom of the chat column', () => {
    render(<ConversationCard ticket={ticket} onLoadOlder={vi.fn()} composer={<textarea aria-label="Phản hồi công khai" />} />)

    expect(screen.getByLabelText('Phản hồi công khai')).toBeInTheDocument()
    expect(screen.getByTestId('owner-chat-viewport')).toHaveClass('h-[480px]')
  })

  it('phân biệt màu trao đổi của Chủ trại và CS, không hiển thị thời gian trong bong bóng chat', () => {
    render(<ConversationCard ticket={{ ...ticket, messages: [
      ...ticket.messages,
      { id: 42, code: 'REPLY', params: {}, text: 'Tin của Chủ trại', kind: 'REPLY', author: 'Chủ trại', authorRole: 'OWNER', createdAt: '2026-11-09T11:05:00Z' },
    ] }} onLoadOlder={vi.fn()} />)

    expect(screen.getByText('Tin mới').closest('.rounded-lg')).toHaveClass('bg-page')
    expect(screen.getByText('Tin của Chủ trại').closest('.rounded-lg')).toHaveClass('bg-[#e8f4ec]')
    expect(screen.getByText('CS · Bộ phận hỗ trợ')).toHaveClass('text-[10px]')
    expect(screen.getByText('CS · Bộ phận hỗ trợ').closest('[data-message-side]')).toHaveClass('justify-start')
    expect(screen.getByText('Chủ trại (bạn)').closest('[data-message-side]')).toHaveClass('justify-end')
    expect(screen.queryByText('09/11/2026 18:00')).not.toBeInTheDocument()
  })

  it('chỉ hiển thị một lần khi nguồn trả về cùng tin nhắn nhiều lần', () => {
    const repeated = ticket.messages[0]
    render(<ConversationCard ticket={{ ...ticket, messages: [repeated, { ...repeated }] }} onLoadOlder={vi.fn()} />)

    expect(screen.getAllByText('Tin mới')).toHaveLength(1)
  })

  it('tải và chèn trang trao đổi cũ theo con trỏ', async () => {
    const user = userEvent.setup()
    const onLoadOlder = vi.fn().mockResolvedValue({
      items: [{ id: 21, code: 'DESCRIPTION', params: {}, text: 'Tin cũ', kind: 'DESCRIPTION', author: 'Chủ trại', authorRole: 'OWNER', createdAt: '2026-11-09T10:00:00Z' }],
      nextBeforeId: null,
      hasMore: false,
    })
    render(<ConversationCard ticket={ticket} onLoadOlder={onLoadOlder} />)

    expect(screen.getByText('Tin mới')).toBeInTheDocument()
    expect(screen.queryByText('Tin cũ')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem trao đổi trước' }))

    expect(onLoadOlder).toHaveBeenCalledWith(41)
    expect(await screen.findByText('Tin cũ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem trao đổi trước' })).not.toBeInTheDocument()
  })
})
