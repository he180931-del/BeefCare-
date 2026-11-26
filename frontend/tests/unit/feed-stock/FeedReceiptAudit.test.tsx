import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeedReceiptAudit } from '../../../src/features/feed-stock/components/FeedReceiptAudit'

describe('receipt history', () => {
  it('shows available posting and void details including the reason', () => {
    render(<FeedReceiptAudit receipt={{ postedByName: 'Quản lý A', postedAt: '2026-11-09T10:30:00Z', voidedByName: 'Chủ trại', voidedAt: '2026-11-10T01:00:00Z', voidReason: 'Nhập trùng' }} />)
    expect(screen.getByText(/Quản lý A/)).toBeInTheDocument()
    expect(screen.getByText(/Chủ trại/)).toBeInTheDocument()
    expect(screen.getByText('Nhập trùng')).toBeInTheDocument()
  })

  it('does not invent history for older receipts without metadata', () => {
    const { container } = render(<FeedReceiptAudit receipt={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
