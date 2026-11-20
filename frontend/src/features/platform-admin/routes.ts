// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadUserAccountRoutes = () => import('./pages/UserAccountRoutes')
export const loadStaffAccessRoutes = () => import('./pages/StaffAccessRoutes')
export const loadAuditRoutes = () => import('./pages/AuditRoutes')
export const loadAdminNoticePage = () => import('./pages/AdminNoticePage')
