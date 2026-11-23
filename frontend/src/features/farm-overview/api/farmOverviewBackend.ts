import { asRecord, textValue } from '../../../shared/api/parse'
import { type BackendTransport } from '../../../shared/api/backendTransport'
import { FARM_TIME_ZONE_ID, addCalendarDays, businessDate, mapDashboard, mapGettingStarted, mapReport, mapReminder, technicianHomeReminders, toBackendGroup, backendStep, type FarmContext, type PenOption } from './farmOverviewMapper'
import { requiredNumber, requiredRows, requiredString } from './farmOverviewError'
import { type BreedOption } from './farmOverviewDto'
import { REPORT_CATALOGUE } from '../domain/reportRules'
import { periodDays } from '../domain/dashboardRules'
import { validateFilters } from '../validation/dashboardValidation'
import { validateReportRequest } from '../validation/reportValidation'
import type { DashboardFilters, GettingStarted, PenInfo, ReportRequest, ReportView, ReminderList, TechnicianHome, ViewerRole } from '../types'

/** Transport/orchestration facade. DTO parsing and domain mapping live in sibling adapter modules. */
export function createFarmOverviewBackendApi({ farmId, transport }: { farmId: string | number | null; transport: BackendTransport }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  let contextPromise: Promise<FarmContext> | undefined
  let pensPromise: Promise<PenOption[]> | undefined
  let breedsPromise: Promise<BreedOption[]> | undefined
  const context = () => {
    contextPromise ??= transport.get(path('/context')).then((value) => { const row = asRecord(value); return { timeZone: FARM_TIME_ZONE_ID, serviceUntil: textValue(row.serviceUntil, textValue(row.currentPeriodUntil)) } }).catch((error: unknown) => { contextPromise = undefined; throw error })
    return contextPromise
  }
  const reminders = async (role: ViewerRole) => { const [body, farm] = await Promise.all([transport.get(path('/reminders')), context()]); const rows = requiredRows(body, 'reminders'); const list: ReminderList = { today: businessDate(), timeZone: farm.timeZone, items: rows.map((row, index) => mapReminder(row, index, role)) }; return { rows, list } }
  const pens = () => { pensPromise ??= transport.get(path('/pens')).then((value) => { const body = asRecord(value); const rows = requiredRows(Array.isArray(value) ? value : body.pens, 'pens'); return rows.map((row): PenOption => ({ id: requiredNumber(row, 'id'), code: requiredString(row, 'code'), name: textValue(row.name, requiredString(row, 'code')), capacity: requiredNumber(row, 'capacity') })) }).catch((error: unknown) => { pensPromise = undefined; throw error }); return pensPromise }
  const breeds = () => { breedsPromise ??= transport.get(path('/catalogues/breeds')).then((value) => requiredRows(value, 'breeds').map((row): BreedOption => ({ id: requiredNumber(row, 'id'), code: requiredString(row, 'code'), name: requiredString(row, 'name') }))).catch((error: unknown) => { breedsPromise = undefined; throw error }); return breedsPromise }
  return {
    async getDashboard(filters: DashboardFilters) {
      const validationError = validateFilters(filters); if (validationError) throw new Error(validationError)
      const [penOptions, farm] = await Promise.all([pens(), context()]); const days = periodDays(filters); const to = filters.period === 'custom' ? filters.to! : businessDate(); const from = filters.period === 'custom' ? filters.from! : addCalendarDays(to, 1 - days); const query = new URLSearchParams({ from, to })
      if (filters.pen) { const selected = penOptions.find((pen) => pen.code === filters.pen); if (!selected) throw new Error('Không tìm thấy chuồng đã chọn. Tải lại bộ lọc rồi thử lại.'); query.set('penId', String(selected.id)) }; if (filters.herdGroup) query.set('herdGroup', toBackendGroup[filters.herdGroup]); if (filters.lifeStage) query.set('lifeStage', filters.lifeStage)
      return mapDashboard(await transport.get(path(`/dashboard?${query.toString()}`)), penOptions, farm, filters, days)
    },
    async getGettingStarted(): Promise<GettingStarted> { return mapGettingStarted(await transport.get(path('/dashboard/getting-started'))) },
    async markStepDone(step: string): Promise<GettingStarted> { const code = backendStep[step]; if (!code) throw new Error('Không tìm thấy bước hướng dẫn.'); return mapGettingStarted(await transport.command(path(`/dashboard/getting-started/steps/${encodeURIComponent(code)}/done`), undefined, { method: 'POST' })) },
    async dismissGettingStarted(): Promise<GettingStarted> { return mapGettingStarted(await transport.command(path('/dashboard/getting-started/dismiss'), undefined, { method: 'POST' })) },
    async listReminders(role: ViewerRole): Promise<ReminderList> { return (await reminders(role)).list },
    async getTechnicianHome(): Promise<TechnicianHome> { const { rows, list } = await reminders('TECHNICIAN'); return { today: list.today, reminders: technicianHomeReminders(list.items), unrecordedFeedings: rows.filter((row) => row.ruleType === 'REM-11').length } },
    async runReport(request: ReportRequest): Promise<ReportView> {
      const validationError = validateReportRequest(request); if (validationError) throw new Error(validationError); const catalogue = REPORT_CATALOGUE.find((item) => item.code === request.reportType); if (!catalogue) throw new Error('Loại báo cáo không hợp lệ.'); const allowed = new Set(catalogue.filters); const [penOptions, breedOptions, farm] = await Promise.all([pens(), breeds(), context()]); const pen = allowed.has('pen') && request.pen ? penOptions.find((item) => item.code === request.pen) : undefined; if (allowed.has('pen') && request.pen && !pen) throw new Error('Không tìm thấy chuồng đã chọn. Tải lại bộ lọc rồi thử lại.'); const breed = allowed.has('breed') && request.breed ? breedOptions.find((item) => item.name === request.breed || item.code === request.breed) : undefined; if (allowed.has('breed') && request.breed && !breed) throw new Error('Không tìm thấy giống đã chọn. Tải lại bộ lọc rồi thử lại.')
      const body = { reportType: request.reportType, from: request.dateFrom, to: request.dateTo, penIds: pen ? [pen.id] : [], breedIds: breed ? [breed.id] : [], herdGroups: allowed.has('group') && request.herdGroup ? [toBackendGroup[request.herdGroup]] : [], lifeStages: allowed.has('stage') && request.lifeStage ? [request.lifeStage] : [] }; return mapReport(await transport.command(path('/dashboard/reports'), body, { method: 'POST' }), request, farm.timeZone)
    },
    async listPenOptions(): Promise<PenInfo[]> { return (await pens()).map(({ id: _id, ...pen }) => pen) },
    async listBreedOptions(): Promise<Array<{ code: string; name: string }>> { return (await breeds()).map(({ code, name }) => ({ code, name })) },
  }
}
