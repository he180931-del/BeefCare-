import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FarmOverviewDemoStore } from '../data/farmOverviewDemoStore'
import { createFarmOverviewBackendApi } from './farmOverviewBackend'
import type { DashboardFilters, ReportRequest, Scenario, ViewerRole } from '../types'
import { demo } from '../../../demo/demoModules'
import { lazyObject } from '../../../shared/lib/lazyObject'

/** `role` và `scenario` chỉ phục vụ mock; backend lấy vai trò từ phiên đăng nhập. */
export interface Viewer { role: ViewerRole; scenario?: Scenario }

const localProfileRoute = (code: string | null, role: ViewerRole): string | null => {
  if (!code || code.startsWith('Bê của')) return null
  const pathCode = encodeURIComponent(code)
  return role === 'TECHNICIAN' ? `/kt/dan-bo/${pathCode}` : `/cattle/${pathCode}`
}

export function createFarmOverviewApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number | null; transport: BackendTransport; store: FarmOverviewDemoStore }) {
  const backend = mode === 'backend' ? createFarmOverviewBackendApi({ farmId, transport }) : null
  return {
    // GET /api/farms/{farmId}/dashboard?from&to&penId&herdGroup&lifeStage
    async getDashboard(filters: DashboardFilters, { role, scenario = 'default' }: Viewer) { return backend ? backend.getDashboard(filters) : store.getDashboard(filters, scenario, role) },
    // GET /api/farms/{farmId}/dashboard/getting-started
    async getGettingStarted({ role, scenario = 'default' }: Viewer) { return backend ? backend.getGettingStarted() : store.getGettingStarted(scenario, role) },
    // POST /api/farms/{farmId}/dashboard/getting-started/steps/{step}/done
    async markStepDone(step: string, { role, scenario = 'default' }: Viewer) { return backend ? backend.markStepDone(step) : store.markStepDone(step, scenario, role) },
    // POST /api/farms/{farmId}/dashboard/getting-started/dismiss
    async dismissGettingStarted({ role, scenario = 'default' }: Viewer) { return backend ? backend.dismissGettingStarted() : store.dismissGettingStarted(scenario, role) },
    // GET /api/farms/{farmId}/reminders
    async listReminders(role: ViewerRole) {
      if (backend) return backend.listReminders(role)
      const list = await store.listReminders(role)
      return { ...list, items: list.items.map((item) => ({ ...item, profileTo: localProfileRoute(item.code, role) })) }
    },
    // POST /api/farms/{farmId}/dashboard/reports
    async runReport(request: ReportRequest, role: ViewerRole) { return backend ? backend.runReport(request) : store.runReport(request, role) },
    async listPenOptions() { return backend ? backend.listPenOptions() : store.listPenOptions() },
    async listBreedOptions() { return backend ? backend.listBreedOptions() : Promise.resolve([{ code: 'ZEBU_RED', name: 'Zebu đỏ' }, { code: 'LAI_SIND', name: 'Lai Sind' }]) },
    // SCR-74: lắp từ GET /api/farms/{farmId}/reminders (nhắc việc và REM-11 bữa ăn chưa ghi).
    async getTechnicianHome() { return backend ? backend.getTechnicianHome() : store.getTechnicianHome() },
  }
}
export const farmOverviewApi = createFarmOverviewApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport, store: lazyObject(() => demo.farmOverview.farmOverviewDemoStore) })
