export const loadReproductionWorklistPage = () => import('./pages/ReproductionWorklistPage')
export const loadCalvingPage = () => import('./pages/CalvingPage')
export const loadReproductionProfileTab = () => import('./components/ReproductionProfileTab')

export { default as ReproductionProfileTab } from './components/ReproductionProfileTab'
export { reproductionApi, resetReproductionDemo } from './api/reproductionApi'
export { REPRODUCTION_DEMO } from './data/reproductionMock'
export { createReproductionDemoStore, reproductionDemoStore } from './data/reproductionDemoStore'
export * from './types'

