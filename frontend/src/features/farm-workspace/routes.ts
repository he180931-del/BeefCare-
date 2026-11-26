// Lazy page loaders for the route table (app/routes/AppRoutes.tsx). Only dynamic imports here, so the entry chunk
// never pulls in this feature's screens or API; other features use index.ts.
export const loadOwnerRegistrationPage = () => import('./pages/OwnerRegistrationPage')
export const loadFarmSelectPage = () => import('./pages/FarmSelectPage')
export const loadFarmRegistrationPage = () => import('./pages/FarmRegistrationPage')
export const loadFarmInformationPage = () => import('./pages/FarmInformationPage')
export const loadMembersPage = () => import('./pages/MembersPage')
export const loadInvitationsPage = () => import('./pages/InvitationsPage')
export const loadAcceptInvitationPage = () => import('./pages/AcceptInvitationPage')
