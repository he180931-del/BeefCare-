import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeedReceiptPrintView } from '../../../src/features/feed-stock/components/FeedReceiptPrintView'
import type { FeedReceipt, FeedReceiptAttachment } from '../../../src/features/feed-stock/types/feedReceipt'

const attachment: FeedReceiptAttachment = {
  id: 91,
  contentType: 'application/pdf',
  fileSize: 12_345,
  originalFilename: 'hoa-don-4521.pdf',
  createdAt: '2026-11-24T03:00:00Z',
}

const baseReceipt: FeedReceipt = {
  id: 8130,
  code: 'PNK-2026-0030',
  receiptDate: '2026-11-20',
  supplierId: 202,
  supplierName: 'HTX cỏ Ba Vì',
  status: 'POSTED',
  goodsAmount: 4_200_000,
  transportFee: 120_000,
  totalPayable: 4_320_000,
  amountPaid: 2_000_000,
  outstanding: 2_320_000,
  paymentState: 'PARTLY_PAID',
  invoiceNumber: 'Phiếu giao 1810',
  receivedBy: 'Trần Quốc Long',
  storageLocation: 'Bãi cỏ',
  note: 'Giao đủ',
  paymentMethod: 'BANK_TRANSFER',
  paymentDate: '2026-11-20',
  paymentDueDate: '2026-12-04',
  createdByName: 'Quản lý A',
  createdAt: '2026-11-20T02:15:00Z',
  postedByName: 'Chủ trại',
  postedAt: '2026-11-20T02:20:00Z',
  version: 1,
  lines: [
    {
      id: 1,
      feedItemId: 101,
      feedCode: 'TA-01',
      feedName: 'Cỏ voi',
      lotNumber: 'L-01',
      expiryDate: '2027-01-15',
      quantityPurchase: 600,
      purchaseUnit: 'kg',
      kgReceived: 600,
      unitPrice: 7_000,
      lineAmount: 4_200_000,
    },
  ],
  payments: [{
    id: 11,
    voucherType: 'FEED_RECEIPT',
    voucherId: 8130,
    voucherCode: 'PNK-2026-0030',
    direction: 'OUTGOING',
    paymentDate: '2026-11-20',
    amount: 2_000_000,
    method: 'BANK_TRANSFER',
    reference: 'UNC-01',
    status: 'RECORDED',
    recordedByName: 'Quản lý A',
  }],
}

function renderPrint(receipt: FeedReceipt = baseReceipt, farmName?: string) {
  return render(<FeedReceiptPrintView receipt={receipt} attachments={[attachment]} farmName={farmName} />)
}

describe('FE-23 receipt print view', () => {
  it('prints authoritative receipt, line, financial, attachment and history data in order', () => {
    renderPrint(baseReceipt, 'Trại Mộc Châu')

    expect(screen.getByRole('heading', { name: 'PHIẾU NHẬP KHO THỨC ĂN' })).toBeInTheDocument()
    expect(screen.getByText('Trại Mộc Châu')).toBeInTheDocument()
    expect(screen.getByText('PNK-2026-0030')).toBeInTheDocument()
    expect(screen.getByText('ĐÃ GHI SỔ')).toBeInTheDocument()
    expect(screen.getByText('HTX cỏ Ba Vì')).toBeInTheDocument()
    expect(screen.getByText('TA-01')).toBeInTheDocument()
    expect(screen.getByText('Cỏ voi')).toBeInTheDocument()
    expect(screen.getAllByText('600 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2.000.000 đ').length).toBeGreaterThan(0)
    expect(screen.getByText('2.320.000 đ')).toBeInTheDocument()
    expect(screen.getByText('Thanh toán một phần')).toBeInTheDocument()
    expect(screen.getByText('hoa-don-4521.pdf')).toBeInTheDocument()
    expect(screen.getByText('Quản lý A')).toBeInTheDocument()

    const document = screen.getByTestId('feed-receipt-print')
    const financialPosition = document.textContent?.indexOf('Tình trạng thanh toán') ?? -1
    const historyPosition = document.textContent?.indexOf('Lịch sử phiếu') ?? -1
    expect(financialPosition).toBeGreaterThanOrEqual(0)
    expect(historyPosition).toBeGreaterThan(financialPosition)

    expect(screen.queryByText(/Địa chỉ|Số dư sau nhập|Tồn sau khi nhập|Tồn kho hiện tại/i)).not.toBeInTheDocument()
    expect(screen.queryByText('123 Đường nhà cung cấp')).not.toBeInTheDocument()
  })

  it('marks a draft as not added to stock and preserves the void reason', () => {
    const draft = { ...baseReceipt, status: 'DRAFT', payments: undefined, paymentState: undefined, amountPaid: 0, outstanding: 4_320_000 }
    const { unmount } = renderPrint(draft)
    expect(screen.getByText('BẢN NHÁP — CHƯA CỘNG KHO')).toBeInTheDocument()
    expect(screen.queryByText('ĐÃ HỦY')).not.toBeInTheDocument()
    unmount()

    renderPrint({ ...baseReceipt, status: 'VOIDED', voidReason: 'Nhập trùng phiếu' })
    expect(screen.getByText('ĐÃ HỦY')).toBeInTheDocument()
    expect(screen.getByText('Lý do hủy').parentElement).toHaveTextContent('Nhập trùng phiếu')
    expect(screen.queryByText('BẢN NHÁP — CHƯA CỘNG KHO')).not.toBeInTheDocument()
  })

  it('does not turn absent authoritative fields into invented facts', () => {
    const sparse = {
      ...baseReceipt,
      supplierName: 'Nhà cung cấp X',
      invoiceNumber: undefined,
      receivedBy: undefined,
      storageLocation: undefined,
      note: undefined,
      amountPaid: undefined,
      outstanding: undefined,
      paymentState: undefined,
      payments: undefined,
      createdByName: undefined,
      createdAt: undefined,
      postedByName: undefined,
      postedAt: undefined,
    }
    renderPrint(sparse)

    const document = screen.getByTestId('feed-receipt-print')
    expect(within(document).queryByText(/Địa chỉ|Tồn sau khi nhập|Tồn kho hiện tại|Giá trị tồn/i)).not.toBeInTheDocument()
    expect(within(document).getAllByText('Chưa có dữ liệu thanh toán').length).toBeGreaterThan(0)
    expect(within(document).queryByText('Chưa có dữ liệu lịch sử')).toBeInTheDocument()
  })
})
