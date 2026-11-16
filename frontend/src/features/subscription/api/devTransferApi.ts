import { asRecord, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { subscriptionDemoStore, type SubscriptionDemoStore } from '../data/subscriptionDemoStore'
import type { Payment } from '../types'

/** `confirmed`: yêu cầu đã được xác nhận ngay; false = giao dịch được lưu làm chứng từ chờ PM đối soát. */
export interface SimulatedTransfer { confirmed: boolean; duplicate: boolean }

/**
 * Chỉ môi trường thử, không thuộc SRS: đóng vai ngân hàng + SePay báo đã nhận tiền cho một yêu cầu.
 * Tách khỏi `subscriptionApi` để bản build production (không render ô giả lập) loại bỏ luôn file này.
 */
export function createDevTransferApi({ mode, transport, store }: { mode: BackendMode; transport: BackendTransport; store: SubscriptionDemoStore }) {
  return {
    /**
     * POST /api/dev/sepay/farms/{farmId}/payments/{paymentId}/transfer (profile dev/local, SePay MOCK/TEST).
     * Backend lấy mã, tài khoản nhận và ngân hàng từ chính yêu cầu rồi chạy đúng luồng xác nhận của webhook.
     */
    async simulateTransfer(farm: number, payment: Payment, amountVnd: number): Promise<SimulatedTransfer> {
      if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) throw new Error('Số tiền phải là số nguyên dương.')
      if (mode !== 'backend') {
        const result = await store.receiveBankTransfer({ transactionId: `DEMO-SIM-${store.now()}-${payment.quoteRef}`, direction: 'IN',
          amountVnd, content: payment.quoteRef, paidAt: new Date(store.now()).toISOString() })
        return { confirmed: result.status === 'CONFIRMED', duplicate: result.status === 'DUPLICATE' }
      }
      try {
        const row = asRecord(await transport.command(`/api/dev/sepay/farms/${farm}/payments/${payment.id}/transfer`, { amountVnd }, { method: 'POST' }))
        if (typeof row.success !== 'boolean' || typeof row.duplicate !== 'boolean') throw new Error('Kết quả giả lập từ máy chủ không hợp lệ.')
        return { confirmed: row.paymentId === payment.id, duplicate: row.duplicate }
      } catch (error) {
        // Route absent (prod) or SePay LIVE: a bare 404 without a BeefCare message code.
        if (error instanceof BackendError && error.status === 404 && !error.code) {
          throw new Error('Máy chủ chưa bật giả lập chuyển khoản (chỉ có ở profile dev/local với SePay MOCK hoặc TEST).')
        }
        throw error
      }
    },
  }
}
export const devTransferApi = createDevTransferApi({ mode: backendMode, transport: backendTransport, store: subscriptionDemoStore })
