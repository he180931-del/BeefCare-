import { FARM_OVERVIEW_SEED } from './farmOverviewMock'
import { buildDashboard, validateFilters } from '../domain/dashboardRules'
import { buildGettingStarted, isMarkable } from '../domain/gettingStarted'
import { isVisibleTo, sortReminders, toItem } from '../domain/reminderRules'
import { buildReport, validateReportRequest } from '../domain/reportRules'
import type {
  DashboardFilters, DashboardView, FarmOverviewSeed, GettingStarted, ReminderList, ReportRequest, ReportView, Scenario, TechnicianHome, ViewerRole,
} from '../types'

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.'

export function createFarmOverviewDemoStore(seed: FarmOverviewSeed = FARM_OVERVIEW_SEED) {
  let state = structuredClone(seed)
  const onboarding = (scenario: Scenario) => state.dashboards[scenario].onboarding
  const requireManagement = (role: ViewerRole) => { if (role === 'TECHNICIAN') throw new Error(FORBIDDEN) }

  return {
    async getDashboard(filters: DashboardFilters, scenario: Scenario, role: ViewerRole): Promise<DashboardView> {
      requireManagement(role)
      const error = validateFilters(filters)
      if (error) throw new Error(error)
      return structuredClone(buildDashboard(state.dashboards[scenario], filters, role))
    },
    async getGettingStarted(scenario: Scenario, role: ViewerRole): Promise<GettingStarted> {
      requireManagement(role)
      return buildGettingStarted(onboarding(scenario), role)
    },
    async markStepDone(step: string, scenario: Scenario, role: ViewerRole): Promise<GettingStarted> {
      requireManagement(role)
      if (!isMarkable(step)) throw new Error('Bước này được tính tự động theo dữ liệu của trại.')
      const onb = onboarding(scenario)
      if (!onb.marked.includes(step)) onb.marked.push(step)
      return buildGettingStarted(onb, role)
    },
    async dismissGettingStarted(scenario: Scenario, role: ViewerRole): Promise<GettingStarted> {
      requireManagement(role)
      const onb = onboarding(scenario)
      onb.dismissed = true
      return buildGettingStarted(onb, role)
    },
    async listReminders(role: ViewerRole): Promise<ReminderList> {
      const items = sortReminders(state.reminders.filter((r) => isVisibleTo(r, role)).map((r) => toItem(r, state.today)))
      return structuredClone({ today: state.today, items })
    },
    async runReport(request: ReportRequest, role: ViewerRole): Promise<ReportView> {
      requireManagement(role)
      const error = validateReportRequest(request)
      if (error) throw new Error(error)
      return structuredClone(buildReport(state.reports[request.reportType], request, state.reportGeneratedAt, state.conceptionByMonth))
    },
    async listPenOptions() {
      return structuredClone(state.dashboards.default.pens.map(({ code, name }) => ({ code, name })))
    },
    async getTechnicianHome(): Promise<TechnicianHome> {
      const items = sortReminders(state.reminders.filter((r) => isVisibleTo(r, 'TECHNICIAN')).map((r) => toItem(r, state.today)))
      return structuredClone({ farmName: state.dashboards.default.farmName, today: state.today, feeding: state.feeding, reminders: items.slice(0, 6) })
    },
    async reset() { state = structuredClone(seed) },
  }
}
export type FarmOverviewDemoStore = ReturnType<typeof createFarmOverviewDemoStore>
export const farmOverviewDemoStore = createFarmOverviewDemoStore()
