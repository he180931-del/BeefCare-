// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadReceiptRoutes = () => import('./pages/ReceiptRoutes')
export const loadManualFinanceRoutes = () => import('./pages/ManualFinanceRoutes')
export const loadCashReportRoutes = () => import('./pages/CashReportRoutes')
export const loadReconciliationNoticePage = () => import('./pages/ReconciliationNoticePage')
export const loadPmSupportNoticePage = () => import('./pages/PmSupportNoticePage')
