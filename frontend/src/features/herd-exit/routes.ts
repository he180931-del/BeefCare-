// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadExportListPage = () => import('./pages/ExportList')
export const loadExportNewPage = () => import('./pages/ExportNew')
export const loadExportDetailPage = () => import('./pages/ExportDetail')
