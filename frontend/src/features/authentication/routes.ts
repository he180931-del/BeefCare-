// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's legal screen or its other authentication pages.
export const loadLegalPage = () => import('./pages/LegalPage')
