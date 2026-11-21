import { BackendError } from './backendClient'

export type VoucherSnapshot = { expectedVersion: number | undefined; backendId?: number }
export type VoucherPaymentSnapshot = { voucherVersion: number | undefined; backendId?: number }

/** A missing version must never turn into the valid first revision (0). */
export function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('Thiếu phiên bản hợp lệ của phiếu. Vui lòng tải bản mới nhất trước khi tiếp tục.')
  }
  return value
}

export function isVersionConflict(error: unknown): error is BackendError {
  return error instanceof BackendError && error.status === 409 && error.code === 'MSG-COM-05'
}
