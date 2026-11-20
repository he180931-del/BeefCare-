// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadReproductionWorklistPage = () => import('./pages/ReproductionWorklistPage')
export const loadCalvingPage = () => import('./pages/CalvingPage')
export const loadTechnicianReproductionPage = () => import('./pages/TechnicianReproductionPage')
