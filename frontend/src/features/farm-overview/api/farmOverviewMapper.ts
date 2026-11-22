import { asRecord, nullableNumber, textValue } from '../../../shared/api/parse'
import { addCalendarDays, businessDate, FARM_TIME_ZONE_ID, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { HERD_GROUP_LABEL, HERD_GROUP_ORDER, LIFE_STAGE_LABEL } from '../domain/dashboardRules'
import { REPORT_CATALOGUE } from '../domain/reportRules'
import { STEP_DEFS } from '../domain/gettingStarted'
import { technicianHomeReminders } from '../domain/reminderRules'
import type {
  DashboardFilters, DashboardView, GettingStarted, HerdGroup, PenInfo, ReportMetricChart, ReportRequest, ReportSection, ReportView,
  ReminderItem, ReminderTarget, ReminderTargetType, ReminderType, ReminderList, TechnicianHome, Urgency, ViewerRole,
} from '../types'
import { failShape, requiredNumber, requiredRows, requiredString } from './farmOverviewError'
import { backendStep, fromBackendGroup, frontendStep, reminderRules, toBackendGroup, type FarmContext, type PenOption } from './farmOverviewDto'

const optionalText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null
const positiveId = (value: unknown): number | null => {
  const number = nullableNumber(value)
  return number !== null && Number.isSafeInteger(number) && number > 0 ? number : null
}
const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const urgencies = new Set<Urgency>(['OVERDUE', 'TODAY', 'UPCOMING'])
const reminderTargetTypes = new Set<ReminderTargetType>([
  'CATTLE_PROFILE', 'GROWTH_RECORD', 'HERD_ENTRY', 'REPRODUCTION_EVENT', 'PREGNANCY_EPISODE', 'VACCINATION_DOSE', 'CALVING_EVENT',
  'CATTLE_LIFE_STAGE', 'PEN_MOVE', 'CALF_REGISTRATION', 'FEED_ITEM', 'FEEDING_LOG', 'DEATH_VOUCHER',
])

function mapReminderTarget(value: unknown): ReminderTarget | null {
  const row = asRecord(value)
  if (typeof row.type !== 'string' || !reminderTargetTypes.has(row.type as ReminderTargetType)) return null
  const date = optionalText(row.date)
  return { type: row.type as ReminderTargetType, id: positiveId(row.id), cattleId: positiveId(row.cattleId), penId: positiveId(row.penId), date: date && isIsoDate(date) ? date : null, sessionNo: positiveId(row.sessionNo), code: optionalText(row.code) }
}

function mapCattleDetail(value: unknown) {
  const row = asRecord(value)
  const ageMonths = nullableNumber(row.ageMonths)
  return { code: optionalText(row.code), breed: optionalText(row.breed), sex: optionalText(row.sex), ageMonths: ageMonths !== null && Number.isInteger(ageMonths) && ageMonths >= 0 ? ageMonths : null, pen: optionalText(row.pen) }
}

function mapBasisValues(value: unknown): Record<string, number | string> {
  const row = asRecord(value)
  return Object.fromEntries(Object.entries(row).filter((entry): entry is [string, number | string] => typeof entry[1] === 'string' || (typeof entry[1] === 'number' && Number.isFinite(entry[1]))))
}

const lastNumericSourcePart = (sourceId: string | null): number | null => {
  if (!sourceId) return null
  const tail = sourceId.split(':').at(-1)
  if (!tail || !/^\d+$/.test(tail)) return null
  return positiveId(Number(tail))
}
const positiveSourcePart = (value: string | undefined): number | null => value && /^\d+$/.test(value) ? positiveId(Number(value)) : null

function sourceIdMatchesTarget(rule: string, sourceType: string | null, sourceId: string | null, target: ReminderTarget): boolean {
  if (!sourceId) return false
  const parts = sourceId.split(':')
  if (target.type === 'HERD_ENTRY') {
    const id = lastNumericSourcePart(sourceId)
    const entryIdFromCattleSource = parts.length >= 4 && parts.at(-2)?.toUpperCase() === 'ENTRY' ? positiveSourcePart(parts.at(-1)) : null
    const directEntry = (rule === 'REM-01' || rule === 'REM-03') && sourceType?.toUpperCase() === 'HERD_ENTRY' && id === target.id
    const weighingEntry = rule === 'REM-01' && sourceType?.toUpperCase() === 'CATTLE' && entryIdFromCattleSource === target.id
    return target.id !== null && (directEntry || weighingEntry)
  }
  if (target.type === 'DEATH_VOUCHER') return rule === 'REM-12' && sourceType?.toLowerCase() === 'herdexitvoucher' && lastNumericSourcePart(sourceId) === target.id
  if (target.type === 'FEEDING_LOG') return rule === 'REM-11' && sourceType?.toUpperCase() === 'PEN' && parts.length === 8 && parts[0] === 'PEN' && parts[2] === 'RATION' && parts[4] === 'DAY' && parts[6] === 'SESSION' && positiveSourcePart(parts[1]) === target.penId && parts[5] === target.date && positiveSourcePart(parts[7]) === target.sessionNo
  return false
}

function reminderSourceAction(rule: string, sourceType: string | null, sourceId: string | null, target: ReminderTarget | null, cattleId: number | null, role: ViewerRole): { to: string | null; openLabel: string | null } {
  if (!target || target.cattleId !== null && cattleId !== null && target.cattleId !== cattleId) return { to: null, openLabel: null }
  if ((role === 'OWNER' || role === 'MANAGER') && target.type === 'HERD_ENTRY' && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.id !== null) return { to: `/herd-entry/${target.id}`, openLabel: 'Xem phiếu nhập' }
  if ((role === 'OWNER' || role === 'MANAGER') && target.type === 'DEATH_VOUCHER' && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.id !== null && target.code) return { to: `/herd-exit/${target.id}`, openLabel: 'Xem phiếu' }
  if (target.type === 'FEEDING_LOG' && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.penId !== null && target.date && target.sessionNo !== null && target.code) {
    const query = new URLSearchParams({ date: target.date }); if (role === 'TECHNICIAN') query.set('readOnly', '1')
    return { to: `/thuc-an/nhat-ky?${query.toString()}`, openLabel: 'Mở nhật ký cho ăn' }
  }
  return { to: null, openLabel: null }
}

const REPORT_ENUM_LABEL: Record<string, string> = { EXTERNAL: 'Mua ngoài', FARM_BORN: 'Bê sinh tại trại', SALE: 'Bán', CULL: 'Loại thải', DEATH: 'Chết / mất', OTHER: 'Khác', UNKNOWN: 'Chưa rõ' }
const labelForKey = (key: string) => ({
  headAtEnd: 'Số bò cuối kỳ', entriesInPeriod: 'Nhập đàn trong kỳ', exitsInPeriod: 'Xuất đàn trong kỳ', entriesBySource: 'Nhập đàn theo nguồn', exitsByType: 'Xuất đàn theo loại', closedCasesByOutcome: 'Ca đóng theo kết quả', validWeighings: 'Lượt cân hợp lệ', averageGroupWeightKg: 'Cân trung bình theo nhóm', estimatedWeightCount: 'Lượt cân ước tính', averageADGKgPerDay: 'Tăng trọng bình quân ngày (kg/ngày)', doses: 'Mũi tiêm trong kỳ', onFarmVaccinations: 'Mũi tiêm tại trại', openedCases: 'Ca mở trong kỳ', movedToChronic: 'Ca chuyển theo dõi mạn tính', closedCases: 'Ca đóng trong kỳ', casesByOutcome: 'Ca theo kết quả', casesBySeverity: 'Ca theo mức độ', chronicAtEnd: 'Ca mạn tính cuối kỳ', treatments: 'Lượt điều trị', treatmentsByMedicine: 'Điều trị theo thuốc', cattleWithActiveMeatWithdrawalAtEnd: 'Bò đang ngưng thịt cuối kỳ', trackedFemales: 'Bò cái theo dõi', breedings: 'Lần phối', checks: 'Lần khám thai', calvings: 'Lần đẻ', liveCalves: 'Bê sinh sống', stillbirths: 'Chết lúc sinh', episodesLost: 'Thai mất', episodesCalved: 'Thai đã đẻ', averageCalvingIntervalDays: 'Khoảng cách lứa đẻ (ngày)', averageDaysOpen: 'Ngày trống trung bình', averageServicesPerConception: 'Số lần phối trên mỗi lần thụ thai', overallConceptionRate: 'Tỷ lệ thụ thai chung', firstServiceConceptionRate: 'Tỷ lệ thụ thai lần phối đầu', pregnancyLossRate: 'Tỷ lệ sẩy thai', averageAgeAtFirstCalvingMonths: 'Tuổi đẻ lứa đầu (tháng)', overdueFemales: 'Cái quá hạn thụ thai', entries: 'Nhập đàn', exits: 'Xuất đàn', penMoves: 'Lượt chuyển chuồng', averageHead: 'Đầu con bình quân', cattleIncluded: 'Bò đủ dữ liệu cân', insufficientWeights: 'Bò thiếu dữ liệu cân', cattleCount: 'Bò đủ dữ liệu cân', gainKg: 'Tổng tăng trọng (kg)', feedKg: 'Thức ăn đã dùng (kg)', feedCost: 'Chi phí thức ăn (đ)', feedKgForIncluded: 'Thức ăn tính tỷ lệ (bò đủ cân, kg)', feedCostForIncluded: 'Chi phí tính tỷ lệ (bò đủ cân, đ)', planned: 'Kế hoạch', done: 'Đã tiêm', deferred: 'Hoãn', overdue: 'Quá hạn', cancelled: 'Đã hủy', feedKgPerGain: 'Thức ăn trên mỗi kg tăng (kg/kg)', feedCostPerGain: 'Chi phí thức ăn trên mỗi kg tăng (đ/kg)', count: 'Số con', recordsWithoutWeight: 'Bản ghi hợp lệ thiếu trọng lượng', estimatedCount: 'Lượt cân ước tính', estimatedShare: 'Tỷ lệ cân ước tính', adgKgPerDay: 'ADG (kg/ngày)', adgSampleSize: 'Số bò có ADG', averageStartWeightKg: 'Cân đầu kỳ (kg)', averageEndWeightKg: 'Cân cuối kỳ (kg)', totalGainKg: 'Tổng tăng trọng (kg)', averageAdgKgPerDay: 'ADG (kg/ngày)', feedUsedKg: 'Thức ăn đã dùng (kg)', feedPerKgGain: 'Thức ăn trên mỗi kg tăng (kg/kg)', feedCostPerKgGain: 'Chi phí thức ăn trên mỗi kg tăng (đ/kg)', targetReached: 'Đạt cân mục tiêu', projectedDaysToTarget: 'Số ngày dự kiến đến mục tiêu',
}[key] ?? REPORT_ENUM_LABEL[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (first) => first.toUpperCase()))
const formatValue = (value: unknown): string => { if (value == null) return 'Chưa có dữ liệu'; if (typeof value === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value); if (typeof value === 'boolean') return value ? 'Có' : 'Không'; if (typeof value === 'string') return value; if (Array.isArray(value)) return value.map(formatValue).join(', '); return Object.entries(asRecord(value)).map(([key, item]) => `${labelForKey(key)}: ${formatValue(item)}`).join(' · ') }

function flattenSummary(summary: Record<string, unknown>): ReportView['tiles'] {
  const tiles: ReportView['tiles'] = []
  const visit = (key: string, value: unknown, parent = '') => {
    const label = [parent, labelForKey(key)].filter(Boolean).join(' · ')
    if (Array.isArray(value) && (value.length === 0 || value.some((item) => item !== null && typeof item === 'object'))) return
    if (value == null || typeof value !== 'object' || Array.isArray(value)) { tiles.push({ label, value: formatValue(value), note: value == null ? 'Chưa có dữ liệu' : '' }); return }
    const record = asRecord(value)
    if (Object.hasOwn(record, 'value') || Object.hasOwn(record, 'n')) { const n = nullableNumber(record.n); const insufficient = textValue(record.status) === 'INSUFFICIENT_DATA' || (n !== null && n < 3); const numerator = nullableNumber(record.numerator); const denominator = nullableNumber(record.denominator); const ratioBasis = numerator !== null && denominator !== null ? `${formatValue(numerator)} / ${formatValue(denominator)}` : ''; const sampleNote = n === null ? (textValue(record.status) || '') : `n = ${n}`; tiles.push({ label, value: insufficient ? 'Chưa đủ dữ liệu' : formatValue(record.value), note: [ratioBasis, sampleNote].filter(Boolean).join(' · ') }); return }
    const entries = Object.entries(record); if (!entries.length) { tiles.push({ label, value: 'Chưa có dữ liệu', note: 'Chưa có dữ liệu' }); return }; entries.forEach(([child, childValue]) => visit(child, childValue, label))
  }
  Object.entries(summary).forEach(([key, value]) => visit(key, value)); return tiles
}

function labelForRow(row: Record<string, unknown>) {
  const dimension = textValue(row.dimension), value = textValue(row.value)
  if (dimension && value) { const dimensionLabel = ({ herdGroup: 'Nhóm đàn', pen: 'Chuồng', breed: 'Giống', purpose: 'Mục đích', lifeStage: 'Giai đoạn', schedule: 'Lịch tiêm', onFarmVaccine: 'Vắc-xin tại trại', caseOutcome: 'Kết quả ca', severity: 'Mức độ', treatmentMedicine: 'Thuốc điều trị', eventTypeAndResult: 'Sự kiện sinh sản', entrySource: 'Nguồn nhập đàn', exitType: 'Loại xuất đàn', penMoveTo: 'Chuồng chuyển đến' } as Record<string, string>)[dimension] ?? labelForKey(dimension); const displayValue = fromBackendGroup[value] ? HERD_GROUP_LABEL[fromBackendGroup[value]!] : REPORT_ENUM_LABEL[value] ?? value; return `${dimensionLabel}: ${displayValue}` }
  const group = textValue(row.group), pen = textValue(row.pen), schedule = textValue(row.schedule), label = textValue(row.label)
  if (label) return label; if (group && pen) return `${fromBackendGroup[group] ? HERD_GROUP_LABEL[fromBackendGroup[group]!] : group} · chuồng ${pen}`; if (pen) return `Chuồng ${pen}`; if (group) return fromBackendGroup[group] ? HERD_GROUP_LABEL[fromBackendGroup[group]!] : group; if (schedule) return schedule; return 'Kết quả'
}
function formatReportDimension(value: string) { const group = fromBackendGroup[value]; if (group) return HERD_GROUP_LABEL[group]; if (Object.hasOwn(LIFE_STAGE_LABEL, value)) return LIFE_STAGE_LABEL[value as keyof typeof LIFE_STAGE_LABEL]; if (Object.hasOwn(REPORT_ENUM_LABEL, value)) return REPORT_ENUM_LABEL[value]; return value }

function mapReportSection(value: unknown): ReportSection {
  const rawSection = asRecord(value), rawRows = requiredRows(rawSection.rows, 'sections.rows'), hidden = new Set(['dimension', 'value', 'pen', 'group', 'stage', 'schedule', 'label']), rawTotal = rawSection.totalRow == null ? null : asRecord(rawSection.totalRow)
  if (rawTotal && (typeof rawTotal.cells !== 'object' || rawTotal.cells === null || Array.isArray(rawTotal.cells))) return failShape('sections.totalRow.cells')
  const totalCells = rawTotal ? asRecord(rawTotal.cells) : {}, keys = [...new Set([...rawRows.flatMap((item) => Object.keys(item)), ...Object.keys(totalCells)].filter((key) => !hidden.has(key)))]
  const rows = rawRows.map((item) => ({ label: typeof item.label === 'string' ? formatReportDimension(item.label) : labelForRow(item), cells: Object.fromEntries(keys.map((key) => [key, formatValue(item[key])])) }))
  return { key: requiredString(rawSection, 'key'), title: requiredString(rawSection, 'title'), rowHeading: requiredString(rawSection, 'rowHeading'), columns: keys.map((key) => ({ key, label: labelForKey(key) })), rows, totalRow: rawTotal ? { label: requiredString(rawTotal, 'label'), cells: Object.fromEntries(keys.map((key) => [key, formatValue(totalCells[key])])) } : null }
}

function mapMetricChart(value: unknown): ReportMetricChart {
  const rawChart = asRecord(value), unit = requiredString(rawChart, 'unit'), optionalNumber = (row: Record<string, unknown>, key: string) => row[key] == null ? null : requiredNumber(row, key)
  const bars = requiredRows(rawChart.bars, 'charts.bars').map((bar) => { const value = optionalNumber(bar, 'value'), sampleSize = optionalNumber(bar, 'sampleSize'), numerator = optionalNumber(bar, 'numerator'), denominator = optionalNumber(bar, 'denominator'); if (sampleSize !== null && (!Number.isSafeInteger(sampleSize) || sampleSize < 0)) return failShape('charts.bars.sampleSize'); if ((numerator === null) !== (denominator === null)) return failShape('charts.bars.ratio'); if (numerator !== null && denominator !== null && (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || numerator > denominator)) return failShape('charts.bars.ratio'); if (unit === '%' && value !== null && (value < 0 || value > 100)) return failShape('charts.bars.value'); if (unit === '%' && (numerator === null || denominator === null || (denominator < 3) !== (value === null))) return failShape('charts.bars.ratio'); return { label: formatReportDimension(requiredString(bar, 'label')), value, sampleSize, numerator, denominator } })
  return { title: requiredString(rawChart, 'title'), sub: requiredString(rawChart, 'sub'), unit, bars }
}

export function mapReport(body: unknown, request: ReportRequest, timeZone: string): ReportView {
  const row = asRecord(body), reportType = requiredString(row, 'reportType') as ReportRequest['reportType'], from = requiredString(row, 'from'), to = requiredString(row, 'to'), generatedAt = requiredString(row, 'generatedAt')
  if (typeof row.summary !== 'object' || row.summary === null || Array.isArray(row.summary)) failShape('summary')
  const summary = asRecord(row.summary), rawRows = requiredRows(row.rows, 'rows'), hidden = new Set(['dimension', 'value', 'pen', 'group', 'stage', 'schedule', 'label']), keys = [...new Set(rawRows.flatMap((item) => Object.keys(item).filter((key) => !hidden.has(key))))], columns = keys.map((key) => ({ key, label: labelForKey(key) })), rows = rawRows.map((item) => ({ label: labelForRow(item), cells: Object.fromEntries(keys.map((key) => [key, formatValue(item[key])])) }))
  let totalRow: ReportView['totalRow'] = null; if (row.totalRow != null) { if (typeof row.totalRow !== 'object' || Array.isArray(row.totalRow)) return failShape('totalRow'); const rawTotal = asRecord(row.totalRow); if (typeof rawTotal.cells !== 'object' || rawTotal.cells === null || Array.isArray(rawTotal.cells)) return failShape('totalRow.cells'); const cells = asRecord(rawTotal.cells); totalRow = { label: requiredString(rawTotal, 'label'), cells: Object.fromEntries(keys.map((key) => [key, formatValue(cells[key])])) } }
  let chart: ReportView['chart'] = null; if (row.chart != null) { const rawChart = asRecord(row.chart); const bars = requiredRows(rawChart.bars, 'chart.bars').map((bar) => { const value = nullableNumber(bar.value), numerator = requiredNumber(bar, 'numerator'), denominator = requiredNumber(bar, 'denominator'); if ((value !== null && (value < 0 || value > 100)) || !Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator || (denominator < 3) !== (value === null)) return failShape('chart.bars.value'); return { label: requiredString(bar, 'label'), value, numerator, denominator } }); chart = { title: requiredString(rawChart, 'title'), sub: requiredString(rawChart, 'sub'), bars } }
  const unavailableData = Array.isArray(row.unavailableData) ? row.unavailableData.filter((item): item is string => typeof item === 'string') : [], sections = row.sections == null ? [] : requiredRows(row.sections, 'sections').map(mapReportSection), charts = row.charts == null ? [] : requiredRows(row.charts, 'charts').map(mapMetricChart), title = REPORT_CATALOGUE.find((item) => item.code === reportType)?.title ?? reportType, allowed = new Set(REPORT_CATALOGUE.find((item) => item.code === reportType)?.filters ?? []), filters = [allowed.has('pen') && request.pen ? `Chuồng ${request.pen}` : '', allowed.has('breed') && request.breed ? `Giống ${request.breed}` : '', allowed.has('group') && request.herdGroup ? HERD_GROUP_LABEL[request.herdGroup] : '', allowed.has('stage') && request.lifeStage ? LIFE_STAGE_LABEL[request.lifeStage] : ''].filter(Boolean), scope = [`${from} – ${to}`, ...filters].join(' · ')
  return { reportType, title, from, to, generatedAt, timeZone, scope, tiles: flattenSummary(summary), columns, rows, totalRow, chart, unavailableData, sections, charts }
}

export function mapDashboard(body: unknown, pens: PenOption[], context: FarmContext, filters: DashboardFilters, days: number): DashboardView {
  const row = asRecord(body), indicators = asRecord(row.indicators), m01 = asRecord(indicators.M01), m02 = asRecord(indicators.M02), m03 = asRecord(indicators.M03), m04 = asRecord(indicators.M04), m05 = asRecord(indicators.M05), m06 = asRecord(indicators.M06), m07 = indicators.M07 == null ? null : asRecord(indicators.M07), m08 = asRecord(indicators.M08), m09 = asRecord(indicators.M09), m01Count = requiredNumber(m01, 'count')
  if (typeof m01.byBreed !== 'object' || m01.byBreed === null || Array.isArray(m01.byBreed)) failShape('M01.byBreed'); const breedBreakdown = Object.entries(asRecord(m01.byBreed)).map(([label, value]) => typeof value === 'number' && Number.isFinite(value) ? { label, count: value } : failShape(`M01.byBreed.${label}`)); const zebu = breedBreakdown.find((breed) => breed.label.toLocaleLowerCase('vi') === 'zebu đỏ')?.count ?? 0, sind = breedBreakdown.find((breed) => breed.label.toLocaleLowerCase('vi') === 'lai sind')?.count ?? 0
  const backendGroups = asRecord(m05.byHerdGroup), groupRows = HERD_GROUP_ORDER.map((group) => { const backendKey = toBackendGroup[group], value = backendGroups[backendKey]; if (typeof value !== 'number' || !Number.isFinite(value)) return failShape(`M05.byHerdGroup.${backendKey}`); return { group, label: HERD_GROUP_LABEL[group], head: value, pregnant: group === 'BREEDING_FEMALE' ? requiredNumber(m05, 'pregnantBreedingFemales') : null } }), m06Groups = asRecord(m06.byHerdGroup), byGroup = Object.entries(m06Groups).flatMap(([group, raw]) => { const mappedGroup = fromBackendGroup[group], average = nullableNumber(asRecord(raw).averageKgPerDay); return mappedGroup && average !== null ? [{ label: HERD_GROUP_LABEL[mappedGroup], value: average }] : [] }), adgSampleCount = requiredNumber(m06, 'sampleCount'), calvingInterval = asRecord(m09.averageCalvingInterval), conceptionRate = asRecord(m09.overallConceptionRate), m08ByPen = requiredRows(m08.byPen, 'M08.byPen'), m08Capacity = requiredNumber(m08, 'totalCapacity'), m08Head = requiredNumber(m08, 'totalHead'), hasBreakdownFilter = Boolean(filters.pen || filters.herdGroup || filters.lifeStage), selectedPen = filters.pen ? m08ByPen.find((pen) => textValue(pen.code) === filters.pen) : undefined
  const m08Filtered = filters.herdGroup || filters.lifeStage ? null : filters.pen ? selectedPen && typeof selectedPen.head === 'number' && typeof selectedPen.capacity === 'number' ? { head: selectedPen.head, capacity: selectedPen.capacity, percent: selectedPen.capacity ? Math.round(selectedPen.head * 100 / selectedPen.capacity) : 0, fullPens: selectedPen.head >= selectedPen.capacity ? 1 : 0 } : null : { head: m08Head, capacity: m08Capacity, percent: m08Capacity ? Math.round(m08Head * 100 / m08Capacity) : 0, fullPens: m08ByPen.filter((pen) => typeof pen.head === 'number' && typeof pen.capacity === 'number' && pen.head >= pen.capacity).length }
  const attention = hasBreakdownFilter ? [] : requiredRows(row.attention, 'attention').map(mapAttention), activeCattle = requiredNumber(row, 'activeCattle'), serviceUntil = context.serviceUntil ? businessDate(new Date(parseBusinessTime(context.serviceUntil))) : '', serviceStatus = requiredString(row, 'serviceStatus'), serviceStatusLabel = ({ ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Hết hạn', SUSPENDED: 'Tạm ngưng' } as Record<string, string>)[serviceStatus] ?? serviceStatus
  return { farmName: requiredString(row, 'farmName'), activeCattle, serviceStatus: serviceStatusLabel, serviceUntil, generatedAt: requiredString(row, 'generatedAt'), timeZone: context.timeZone, empty: m01Count === 0, pens, indicators: { m01: { total: m01Count, zebu, sind, breedBreakdown }, m02: { total: requiredNumber(m02, 'attentionCount'), treating: requiredNumber(m02, 'underTreatment'), withdrawal: requiredNumber(m02, 'activeWithdrawal') }, m03: { total: hasBreakdownFilter ? null : requiredNumber(m03, 'dueWithin7Days'), overdue: hasBreakdownFilter ? null : requiredNumber(m03, 'overdue') }, m04: { total: requiredNumber(m04, 'within30Days'), within7: requiredNumber(m04, 'within7Days') }, m05: { rows: groupRows, total: groupRows.reduce((total, group) => total + group.head, 0), pregnant: requiredNumber(m05, 'pregnantBreedingFemales') }, m06: { value: nullableNumber(m06.averageKgPerDay), byGroup, days, unavailable: days < 14 ? 'PERIOD_TOO_SHORT' : adgSampleCount === 0 ? 'NO_DATA' : null }, m07: m07 ? { total: requiredNumber(m07, 'overdueCount') } : null, m08: m08Filtered, m08Unavailable: filters.herdGroup || filters.lifeStage ? 'FILTER_NOT_SUPPORTED' : null, m09: { calvingIntervalDays: nullableNumber(calvingInterval.value), conceptionRate: nullableNumber(conceptionRate.value) === null ? null : nullableNumber(conceptionRate.value)! * 100, overdueFemales: requiredNumber(m09, 'overdueCount'), calvingIntervalN: requiredNumber(calvingInterval, 'n'), conceptionRateN: requiredNumber(conceptionRate, 'n') } }, attention, attentionUnavailable: hasBreakdownFilter }
}

// Backend không gửi "type" cho dòng bê nháp (A02), phiếu chết chờ duyệt (A03) và bò đạt cân xuất (A04);
// các dòng đó được nhận diện theo trường đặc trưng bên dưới, dòng lạ vẫn báo lỗi ở cuối hàm.
function mapAttention(row: Record<string, unknown>): DashboardView['attention'][number] {
  const type = optionalText(row.type) ?? '', code = textValue(row.displayCode, textValue(row.cattleCode, textValue(row.code, '—'))), cattleTarget = code !== '—' && typeof row.cattleId === 'number' ? `/cattle/${encodeURIComponent(code)}` : null, common = { code, pen: textValue(row.pen, '—'), group: undefined, stage: undefined, to: null as string | null }
  if (type === 'OVERDUE_VACCINATION') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Mũi tiêm quá hạn', status: 'Quá hạn', tone: 'err' }; if (type === 'BREEDING_WINDOW') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Đang trong cửa sổ phối', status: 'Hôm nay', tone: 'warn' }; if (type === 'PREGNANCY_CHECK_DUE') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Đến hạn khám thai', status: 'Đến hạn', tone: 'warn' }; if (type === 'CALVING_WITHIN_7_DAYS') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Dự kiến đẻ trong 7 ngày', status: 'Sắp đẻ', tone: 'info' }; if (type === 'CASE_OPENED_TODAY') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Ca sức khỏe mới mở', status: 'Hôm nay', tone: 'info' }; if (type === 'A02' || Object.hasOwn(row, 'calfOutcomeId')) return { ...common, code: textValue(row.damCode, code), kind: 'A02', to: null, issue: 'Bê nháp chờ xác nhận', status: 'Chờ xác nhận', tone: 'warn' }; if (type === 'A03' || Object.hasOwn(row, 'voucherId')) return { ...common, code: textValue(row.code, '—'), kind: 'A03', to: null, issue: 'Phiếu chết chờ duyệt', status: 'Chờ xác nhận', tone: 'warn' }; if (type === 'A04' || Object.hasOwn(row, 'targetKg')) return { ...common, kind: 'A04', to: cattleTarget, issue: typeof row.latestWeightKg === 'number' && typeof row.targetKg === 'number' ? `Đạt cân xuất chuồng · ${formatValue(row.latestWeightKg)} / ${formatValue(row.targetKg)} kg` : 'Đạt cân xuất chuồng', status: 'Đạt mục tiêu', tone: 'ok' }; return failShape(`attention.type=${type}`)
}

function profileRoute(target: ReminderTarget | null, cattleId: number | null, cattleCode: string | null, role: ViewerRole): string | null { if (!target || target.type !== 'CATTLE_PROFILE' || target.id === null || target.id !== target.cattleId || target.id !== cattleId || !target.code || target.code !== cattleCode) return null; const code = encodeURIComponent(target.code); return role === 'TECHNICIAN' ? `/kt/dan-bo/${code}` : `/cattle/${code}` }
export function mapReminder(row: Record<string, unknown>, index: number, role: ViewerRole): ReminderItem {
  const rule = requiredString(row, 'ruleType'), ruleInfo = reminderRules[rule]; if (!ruleInfo) return failShape(`ruleType=${rule}`); const sourceRecord = optionalText(row.sourceRecord), reminderId = nullableNumber(row.id), sourceType = optionalText(row.sourceType), sourceId = optionalText(row.sourceId), cattleId = positiveId(row.cattleId), cattle = mapCattleDetail(row.cattle), cattleProfileTarget = mapReminderTarget(row.cattleProfileTarget), sourceTarget = mapReminderTarget(row.sourceTarget), sourceSummary = optionalText(row.sourceSummary), dueTime = typeof row.dueTime === 'string' ? row.dueTime : '', id = reminderId ?? `${rule}:${sourceRecord || String(cattleId ?? 'unknown')}:${dueTime}:${index}`, rawUrgency = requiredString(row, 'urgency') as Urgency
  if (!urgencies.has(rawUrgency)) return failShape(`urgency=${rawUrgency}`); const parameterVersion = nullableNumber(row.parameterVersion), basisMissing = optionalText(row.basisMissing), basisValues = mapBasisValues(row.basisValues), action = sourceSummary ? reminderSourceAction(rule, sourceType, sourceId, sourceTarget, cattleId, role) : { to: null, openLabel: null }
  return { id, rule: `${rule} · ${ruleInfo.title}`, type: ruleInfo.type as ReminderType, title: ruleInfo.title, code: cattle.code, breed: cattle.breed, pen: cattle.pen, dueAt: dueTime || null, windowEnd: typeof row.windowEnd === 'string' ? row.windowEnd : undefined, highlighted: row.highlighted === true, basis: textValue(row.basisLabel) || null, basisMissing: basisMissing ?? undefined, parameterVersion, source: sourceSummary ?? (sourceRecord ? `Bản ghi nguồn ${sourceRecord}` : 'Chưa có dữ liệu nguồn'), to: action.to, openLabel: action.openLabel, urgency: rawUrgency, lifecycleStatus: 'ACTIVE', cattleId, sex: cattle.sex, ageMonths: cattle.ageMonths, sourceType, sourceId, sourceSummary, basisValues, cattleProfileTarget, sourceTarget, profileTo: profileRoute(cattleProfileTarget, cattleId, cattle.code, role) }
}

export function mapGettingStarted(body: unknown): GettingStarted { const row = asRecord(body), steps = requiredRows(row.steps, 'steps').map((stepRow) => { const serverStep = requiredString(stepRow, 'step'), step = frontendStep[serverStep], definition = STEP_DEFS.find((item) => item.step === step); if (!step || !definition) return failShape(`step=${serverStep}`); return { step, label: definition.label, screen: definition.screen, done: stepRow.done === true, markable: stepRow.markable === true } }); return { visible: row.visible === true, dismissed: row.dismissed === true, allDone: row.allDone === true, steps } }

export { backendStep, toBackendGroup, technicianHomeReminders, FARM_TIME_ZONE_ID, addCalendarDays, businessDate }
export type { FarmContext, PenOption }
