import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { farmOverviewDemoStore, type FarmOverviewDemoStore } from '../data/farmOverviewDemoStore'
import type { DashboardFilters, ReportRequest, Scenario, ViewerRole } from '../types'

/** `role` và `scenario` chỉ phục vụ mock; backend lấy vai trò từ phiên đăng nhập. */
export interface Viewer { role: ViewerRole; scenario?: Scenario }

export function createFarmOverviewApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: FarmOverviewDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('tổng quan trang trại') }
  return {
    // GET /api/farms/{farmId}/dashboard?from&to&penId&herdGroup&lifeStage
    async getDashboard(filters: DashboardFilters, { role, scenario = 'default' }: Viewer) { requireLocal(); return store.getDashboard(filters, scenario, role) },
    // GET /api/farms/{farmId}/dashboard/getting-started
    async getGettingStarted({ role, scenario = 'default' }: Viewer) { requireLocal(); return store.getGettingStarted(scenario, role) },
    // POST /api/farms/{farmId}/dashboard/getting-started/steps/{step}/done
    async markStepDone(step: string, { role, scenario = 'default' }: Viewer) { requireLocal(); return store.markStepDone(step, scenario, role) },
    // POST /api/farms/{farmId}/dashboard/getting-started/dismiss
    async dismissGettingStarted({ role, scenario = 'default' }: Viewer) { requireLocal(); return store.dismissGettingStarted(scenario, role) },
    // GET /api/farms/{farmId}/reminders
    async listReminders(role: ViewerRole) { requireLocal(); return store.listReminders(role) },
    // POST /api/farms/{farmId}/dashboard/reports
    async runReport(request: ReportRequest, role: ViewerRole) { requireLocal(); return store.runReport(request, role) },
    // chưa có API (danh sách chuồng cho bộ lọc báo cáo; sẽ lấy từ API chuồng trại)
    async listPenOptions() { requireLocal(); return store.listPenOptions() },
    // chưa có API (trang chủ Kỹ thuật viên gộp từ GET /api/farms/{farmId}/reminders và dữ liệu khẩu phần REM-11)
    async getTechnicianHome() { requireLocal(); return store.getTechnicianHome() },
  }
}
export const farmOverviewApi = createFarmOverviewApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: farmOverviewDemoStore })
