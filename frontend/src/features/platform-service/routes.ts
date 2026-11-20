// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadFarmServiceRoutes = () => import('./pages/FarmServiceRoutes')
export const loadPlatformSubscriptionRoutes = () => import('./pages/PlatformSubscriptionRoutes')
export const loadPaymentReconciliationRoutes = () => import('./pages/PaymentReconciliationRoutes')
export const loadPlanPriceRoutes = () => import('./pages/PlanPriceRoutes')
