import { DEFAULT_FAQ, DEFAULT_FEATURES } from './landingContent'

/** Email dành riêng cho chế độ mô phỏng để xem các khung đăng nhập thất bại (SCR-02). */
export const MOCK_WRONG_CREDENTIALS_EMAIL = 'sai@beefcare.local'
export const MOCK_SUSPENDED_EMAIL = 'tam-ngung@beefcare.local'
export const MOCK_EXISTING_ACCOUNT_EMAIL = 'da-co@beefcare.local'

export const MOCK_PRICES = {
  id: 1, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: '2026-01-01T00:00:00Z',
  terms: 'Giá trọn kỳ, chuyển khoản một lần, không tự gia hạn.',
}

/** Cùng hình dạng với `LandingContent` của OpenAPI (GET /api/public/landing). */
export const MOCK_LANDING = {
  name: 'BeefCare',
  introduction: 'Ghi nhận tại chuồng, theo dõi sức khỏe và sinh sản, nhận nhắc việc đúng lúc — trên một hệ thống dễ dùng.',
  features: DEFAULT_FEATURES.map(([title, description]) => ({ title, description })),
  faq: DEFAULT_FAQ.map(([question, answer]) => ({ question, answer })),
  prices: MOCK_PRICES,
  contactEmail: 'beefcare@gmail.com',
}
