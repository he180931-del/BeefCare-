// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadFeedStockPage = () => import('./pages/FeedStockPage')
export const loadFeedReceiptPage = () => import('./pages/FeedReceiptPage')
export const loadFeedReceiptFormPage = () => import('./pages/FeedReceiptFormPage')
export const loadFeedStockAdjustmentPage = () => import('./pages/FeedStockAdjustmentPage')
export const loadFeedStockAdjustmentFormPage = () => import('./pages/FeedStockAdjustmentFormPage')
export const loadFeedRationPage = () => import('./pages/FeedRationPage')
export const loadFeedRationFormPage = () => import('./pages/FeedRationFormPage')
export const loadFeedFeedingPage = () => import('./pages/FeedFeedingPage')
export const loadFeedTodayRationsPage = () => import('./pages/FeedTodayRationsPage')
export const loadFeedCataloguePage = () => import('./pages/FeedCataloguePage')
export const loadFeedConsumptionReportPage = () => import('./pages/FeedConsumptionReportPage')
