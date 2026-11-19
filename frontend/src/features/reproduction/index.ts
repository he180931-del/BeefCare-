export const loadReproductionWorklistPage = () => import('./pages/ReproductionWorklistPage')
export const loadCalvingPage = () => import('./pages/CalvingPage')

export { default as ReproductionProfileTab } from './components/ReproductionProfileTab'
export { reproductionApi, resetReproductionDemo } from './api/reproductionApi'
export { createReproductionDemoStore, reproductionDemoStore } from './data/reproductionDemoStore'
export * from './types'

export const loadTechnicianReproductionPage = () => import('./pages/TechnicianReproductionPage')
export { default as ReproductionTechnicianTab } from './components/ReproductionTechnicianTab'
