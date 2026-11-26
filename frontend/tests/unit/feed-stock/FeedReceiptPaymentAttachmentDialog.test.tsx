import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { recordPayment, uploadPaymentAttachment } = vi.hoisted(() => ({
  recordPayment: vi.fn(),
  uploadPaymentAttachment: vi.fn(),
}))

vi.mock('../../../src/features/feed-stock/api/feedReceiptApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/feed-stock/api/feedReceiptApi')>()),
  recordFeedReceiptPayment: recordPayment,
  uploadFeedReceiptPaymentAttachment: uploadPaymentAttachment,
}))

import { FeedReceiptPaymentDialog } from '../../../src/features/feed-stock/components/FeedReceiptDialogs'

const receipt = {
  id: 8130, code: 'PNK-2026-0030', receiptDate: '2026-11-01', supplierId: 201, supplierName: 'NCC 1', status: 'POSTED',
  goodsAmount: 1200, transportFee: 100, totalPayable: 1300, amountPaid: 300, outstanding: 1000, version: 3, lines: [],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('payment attachment partial failure', () => {
  it('retries only attachment upload after payment has already been committed', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    recordPayment.mockResolvedValue({
      payment: { id: 44, voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: receipt.code, direction: 'PAY', paymentDate: '2026-11-10', amount: 1000, method: 'BANK_TRANSFER', status: 'RECORDED' },
      summary: { voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: receipt.code, total: 1300, paid: 1300, outstanding: 0, overpaid: 0, state: 'PAID', voucherVersion: 4 },
      payments: [],
    })
    const attachment = { id: 73, contentType: 'application/pdf', fileSize: 4, originalFilename: 'receipt.pdf', createdAt: '2026-11-10T06:00:00Z' }
    uploadPaymentAttachment.mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValueOnce(attachment)
    render(<FeedReceiptPaymentDialog record={receipt} onClose={vi.fn()} onDone={onDone} allowAttachments />)
    const dialog = screen.getByRole('dialog', { name: 'Ghi trả nhà cung cấp' })
    const file = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' })

    await user.upload(within(dialog).getByLabelText('Chọn chứng từ đính kèm'), file)
    await user.click(within(dialog).getByRole('button', { name: 'Ghi khoản trả' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Khoản trả đã được ghi; chứng từ chưa tải lên.')
    expect(recordPayment).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Thử tải chứng từ lại' }))
    expect(await onDone).toHaveBeenCalledWith(expect.objectContaining({
      payment: expect.objectContaining({ id: 44, attachments: [attachment] }),
      payments: [expect.objectContaining({ id: 44, attachments: [attachment] })],
    }))
    expect(recordPayment).toHaveBeenCalledTimes(1)
    expect(uploadPaymentAttachment).toHaveBeenCalledTimes(2)
    expect(uploadPaymentAttachment).toHaveBeenLastCalledWith(8130, 44, file, expect.objectContaining({ key: expect.any(String) }))
  })
})
