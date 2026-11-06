export const loadProfilePage = () => import('./pages/ProfilePage')
export const loadTechnicianAccountPage = () => import('./pages/TechnicianAccountPage')
export const loadPlatformProfilePage = () => import('./pages/PlatformProfilePage')
export { accountApi, createAccountApi, type AccountApi } from './api/accountApi'
export { accountDemoStore, createAccountDemoStore, type AccountDemoStore } from './data/accountDemoStore'
export { validatePasswordChange, validateProfile } from './domain/profileRules'
export type { AccountIdentity, AccountProfile, PasswordChangeInput, ProfileUpdateInput } from './types'
