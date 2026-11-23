// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadCowListPage = () => import('./pages/CowList')
export const loadCowProfilePage = () => import('./pages/CowProfile')
export const loadTechnicianCattleRoutes = () => import('./pages/TechnicianCattleRoutes')
export const loadScanQrPage = () => import('./pages/ScanQrPage')
