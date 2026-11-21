import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { announcementsApi } from '../../farm-announcements'
import { farmOverviewApi, type Viewer } from '../api/farmOverviewApi'
import type {
  DashboardFilters,
  DashboardView,
  GettingStarted,
  ReportRequest,
  ReportView,
  ReminderList,
  TechnicianHome,
  ViewerRole,
} from '../types'

/**
 * Feature-owned read/command boundary for farm overview pages.
 * Pages keep route and presentation state; this hook owns query lifecycles
 * and exposes the feature commands without leaking the API adapter upward.
 */
export function useFarmDashboardUseCases(filters: DashboardFilters, viewer: Viewer) {
  const filtersApplied = Boolean(filters.pen || filters.herdGroup || filters.lifeStage)
  const overviewFilters: DashboardFilters = {
    period: filters.period,
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }
  const overview = useQuery<DashboardView>(() => farmOverviewApi.getDashboard(overviewFilters, viewer), [overviewFilters, viewer])
  const filtered = useQuery<DashboardView | null>(
    () => filtersApplied ? farmOverviewApi.getDashboard(filters, viewer) : Promise.resolve(null),
    [filters, viewer, filtersApplied],
  )
  const gettingStarted = useQuery<GettingStarted>(() => farmOverviewApi.getGettingStarted(viewer), [viewer])
  const markStepDone = useCallback((step: string) => farmOverviewApi.markStepDone(step, viewer), [viewer])
  const dismissGettingStarted = useCallback(() => farmOverviewApi.dismissGettingStarted(viewer), [viewer])
  return { overview, filtered, gettingStarted, filtersApplied, markStepDone, dismissGettingStarted }
}

export function useManagementReportUseCases(request: ReportRequest, role: ViewerRole) {
  const pens = useQuery(() => farmOverviewApi.listPenOptions(), [])
  const breeds = useQuery(() => farmOverviewApi.listBreedOptions(), [])
  const report = useQuery<ReportView>(() => farmOverviewApi.runReport(request, role), [request, role])
  return { pens, breeds, report }
}

export function useFarmReminders(role: ViewerRole) {
  return useQuery<ReminderList>(() => farmOverviewApi.listReminders(role), [role])
}

export function useTechnicianHomeUseCases(viewerName: string) {
  const viewer = { name: viewerName, role: 'TECHNICIAN' as const }
  const home = useQuery<TechnicianHome>(() => farmOverviewApi.getTechnicianHome(), [])
  const unread = useQuery(() => announcementsApi.listUnread(viewer, 3), [viewerName])
  return { home, unread }
}

export function useTechnicianReminders() {
  return useQuery<ReminderList>(() => farmOverviewApi.listReminders('TECHNICIAN'), [])
}
