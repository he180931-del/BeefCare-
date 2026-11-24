import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResolutionCard } from '../../../src/features/support/components/ResolutionCard'
import type { Ticket } from '../../../src/features/support/types'

const ticket: Ticket = {
  id: 20,
  code: 'TK-0020',
  subject: 'Kiểm tra kết quả',
  category: 'OTHER',
  priority: 'NORMAL',
  status: 'RESOLVED',
  scope: 'ACCOUNT',
  farmId: null,
  farmName: null,
  requesterId: 1,
  requester: 'Chủ trại',
  assignedCsId: 2,
  assignedCs: 'CS',
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-25T08:00:00Z',
  version: 20,
  messages: [],
  resolutions: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    version: index + 1,
    content: `Kết quả ${index + 1}`,
    resolvedBy: 'Nhân viên hỗ trợ',
    resolvedAt: `2026-11-${String(index + 1).padStart(2, '0')}T08:00:00Z`,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgmentComment: null,
    reviewed: false,
  })),
  history: [],
}

describe('ResolutionCard', () => {
  it('phân trang mỗi 10 kết quả và giữ bảng trong vùng cuộn riêng', async () => {
    const user = userEvent.setup()
    render(<ResolutionCard ticket={ticket} busy={false} onConfirm={vi.fn()} onReopen={vi.fn()} />)

    const viewport = screen.getByRole('region', { name: 'Danh sách kết quả giải quyết' })
    expect(viewport).toHaveClass('overflow-y-auto')
    expect(screen.getByText('Kết quả 12')).toBeInTheDocument()
    expect(screen.getByText('Kết quả 3')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả 2')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(screen.getByText('Kết quả 2')).toBeInTheDocument()
    expect(screen.getByText('Kết quả 1')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả 12')).not.toBeInTheDocument()
  })
})
