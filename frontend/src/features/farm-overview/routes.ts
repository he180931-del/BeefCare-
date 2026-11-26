// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadFarmDashboardPage = () => import('./pages/FarmDashboardPage')
export const loadRemindersPage = () => import('./pages/RemindersPage')
export const loadManagementReportPage = () => import('./pages/ManagementReportPage')
export const loadCashFlowReportPage = () => import('./pages/CashFlowReportPage')
export const loadTechnicianHomePage = () => import('./pages/TechnicianHomePage')
export const loadTechnicianRemindersPage = () => import('./pages/TechnicianRemindersPage')
