// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadProfilePage = () => import('./pages/ProfilePage')
export const loadTechnicianAccountPage = () => import('./pages/TechnicianAccountPage')
export const loadPlatformProfilePage = () => import('./pages/PlatformProfilePage')
