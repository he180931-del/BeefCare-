import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeedReceiptSummary from '../../../src/features/feed-stock/components/FeedReceiptSummary'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'

// docs/BeefCare-Bento-Grid.md §3 + Figma Tab 21 ①b: lượng nhập là khối nổi bật; công nợ chỉ vàng khi còn nợ thật.
const tileOf = (label: string) => screen.getByText(label).closest('.rounded-2xl') as HTMLElement

describe('feed receipt summary (Bento)', () => {
  it('uses the received quantity as the emphasis block and marks the open debt yellow', () => {
    render(<FeedReceiptSummary rows={FEED_RECEIPT_MOCK} suppliers={[]} />)

    expect(tileOf('Nhập kho 30 ngày qua')).toHaveClass('bg-brand-dark')
    expect(tileOf('Còn nợ nhà cung cấp')).toHaveClass('bg-warn-bg')
    expect(tileOf('Nhà cung cấp đang giao dịch')).toHaveClass('bg-white')
  })

  it('keeps the debt tile white once every posted receipt is paid', () => {
    const paid = FEED_RECEIPT_MOCK.map((row) => ({ ...row, outstanding: 0, amountPaid: row.totalPayable }))
    render(<FeedReceiptSummary rows={paid} suppliers={[]} />)

    expect(screen.getByText('0 đ')).toBeInTheDocument()
    expect(tileOf('Còn nợ nhà cung cấp')).toHaveClass('bg-white')
    expect(tileOf('Còn nợ nhà cung cấp')).not.toHaveClass('bg-warn-bg')
  })
})
