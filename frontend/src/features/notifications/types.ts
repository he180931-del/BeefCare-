// Thông báo của Chủ trại (SCR-45). Tên trường theo DTO NotificationView trong OpenAPI.
export type NotificationCategory = 'SUBSCRIPTION_PAYMENT' | 'SUPPORT'
export type NotificationTargetType = 'PAYMENT_REQUEST' | 'SUBSCRIPTION' | 'FARM_SERVICE' | 'TICKET'
export type NotificationTab = 'ALL' | NotificationCategory

export interface NotificationView {
  id: number
  category: NotificationCategory
  title: string
  summary: string
  targetType: NotificationTargetType
  targetId: number
  /** Farm owning a payment target; absent for targets that are not farm-scoped here. */
  farmId?: number | null
  createdTime: string
  readTime: string | null
}
