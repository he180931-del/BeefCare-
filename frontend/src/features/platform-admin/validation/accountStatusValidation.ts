/**
 * Field-level validation for the account and platform-access dialogs.
 *
 * The permission/state checks remain in `domain/platformRules`; this module
 * only validates the free-form reason supplied by the operator.
 */
export const ACCOUNT_REASON_MAX = 500

export const ACCOUNT_REASON_MESSAGES = {
  required: 'Lý do là bắt buộc.',
  rule: 'Lý do cần từ 5 đến 500 ký tự, trong đó ít nhất 5 ký tự không phải khoảng trắng.',
} as const

export function validateReason(reason: string): string | null {
  const text = reason.trim()
  if (!text) return ACCOUNT_REASON_MESSAGES.required
  if (text.length > ACCOUNT_REASON_MAX || text.replace(/\s/g, '').length < 5) return ACCOUNT_REASON_MESSAGES.rule
  return null
}
