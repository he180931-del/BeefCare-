import { asRecord, asRows, nullableNumber, textValue } from '../../../shared/api/parse'
import { type BackendTransport } from '../../../shared/api/backendTransport'
import { addCalendarDays, businessDate, FARM_TIME_ZONE_ID, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { REPORT_CATALOGUE } from '../domain/reportRules'
import { validateReportRequest } from '../validation/reportValidation'
import { HERD_GROUP_LABEL, HERD_GROUP_ORDER, LIFE_STAGE_LABEL, periodDays } from '../domain/dashboardRules'
import { validateFilters } from '../validation/dashboardValidation'
import { STEP_DEFS } from '../domain/gettingStarted'
import type {
  DashboardFilters, DashboardView, GettingStarted, HerdGroup, PenInfo, ReportMetricChart, ReportRequest, ReportSection, ReportView,
  ReminderItem, ReminderList, ReminderTarget, ReminderTargetType, ReminderType, Urgency, ViewerRole,
} from '../types'

type FarmContext = { timeZone: string; serviceUntil: string }
type PenOption = PenInfo & { id: number }
type BreedOption = { id: number; code: string; name: string }

const failShape = (field: string): never => { throw new Error(`Dữ liệu máy chủ không hợp lệ: thiếu ${field}.`) }
const requiredString = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' ? row[key] as string : failShape(key)
const requiredNumber = (row: Record<string, unknown>, key: string) => typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] as number : failShape(key)
const requiredRows = (value: unknown, field: string) => Array.isArray(value) ? asRows(value) : failShape(field)

const toBackendGroup: Record<HerdGroup, string> = {
  BREEDING_FEMALE: 'BREEDING_FEMALES', YOUNG_STOCK: 'YOUNG_STOCK', FATTENING: 'FATTENING', CALF: 'CALVES', BREEDING_BULL: 'BREEDING_BULLS', OTHER: 'OTHER',
}
const fromBackendGroup: Record<string, HerdGroup> = Object.fromEntries(Object.entries(toBackendGroup).map(([front, backend]) => [backend, front])) as Record<string, HerdGroup>
const backendStep: Record<string, string> = {
  PENS: 'CREATE_PENS', BREEDS_PURPOSES: 'REVIEW_BREEDS_AND_PURPOSES', VACCINE_DOSES: 'COMPLETE_VACCINE_DOSES',
  REFERENCE_MEDICINES: 'ADD_REFERENCE_MEDICINES', FARM_PARAMETERS: 'CHECK_FARM_PARAMETERS', INVITE_MEMBERS: 'INVITE_MEMBERS', FIRST_HERD_ENTRY: 'FIRST_HERD_ENTRY_VOUCHER',
}
const frontendStep = Object.fromEntries(Object.entries(backendStep).map(([front, backend]) => [backend, front])) as Record<string, string>

const reminderRules: Record<string, { type: ReminderType; title: string }> = {
  'REM-01': { type: 'weighing', title: 'Đến hạn cân' },
  'REM-02': { type: 'breeding', title: 'Cửa sổ phối' },
  'REM-03': { type: 'pregnancy-check', title: 'Đến hạn khám thai' },
  'REM-04': { type: 'pregnancy-check', title: 'Khám lại thai' },
  'REM-05': { type: 'calving', title: 'Sắp đẻ' },
  'REM-06': { type: 'vaccination', title: 'Mũi tiêm đến hạn' },
  'REM-07': { type: 'breeding', title: 'Sẵn sàng phối sau đẻ' },
  'REM-08': { type: 'pen-stage', title: 'Gợi ý chuyển chuồng hoặc giai đoạn' },
  'REM-09': { type: 'draft-calf', title: 'Bê nháp chờ xác nhận' },
  'REM-10': { type: 'feed', title: 'Tồn thức ăn thấp' },
  'REM-11': { type: 'feed', title: 'Bữa ăn chưa ghi' },
  'REM-12': { type: 'health', title: 'Chết hoặc mất chờ xác nhận' },
  'REM-13': { type: 'exit-finishing', title: 'Đạt cân xuất chuồng' },
}
const urgencies = new Set<Urgency>(['OVERDUE', 'TODAY', 'UPCOMING'])
const reminderTargetTypes = new Set<ReminderTargetType>([
  'CATTLE_PROFILE', 'GROWTH_RECORD', 'HERD_ENTRY', 'REPRODUCTION_EVENT', 'PREGNANCY_EPISODE',
  'VACCINATION_DOSE', 'CALVING_EVENT', 'CATTLE_LIFE_STAGE', 'PEN_MOVE', 'CALF_REGISTRATION',
  'FEED_ITEM', 'FEEDING_LOG', 'DEATH_VOUCHER',
])

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

function mapReminderTarget(value: unknown): ReminderTarget | null {
  const row = asRecord(value)
  if (typeof row.type !== 'string' || !reminderTargetTypes.has(row.type as ReminderTargetType)) return null
  const date = optionalText(row.date)
  return {
    type: row.type as ReminderTargetType,
    id: positiveId(row.id),
    cattleId: positiveId(row.cattleId),
    penId: positiveId(row.penId),
    date: date && isIsoDate(date) ? date : null,
    sessionNo: positiveId(row.sessionNo),
    code: optionalText(row.code),
  }
}

function mapCattleDetail(value: unknown) {
  const row = asRecord(value)
  const ageMonths = nullableNumber(row.ageMonths)
  return {
    code: optionalText(row.code),
    breed: optionalText(row.breed),
    sex: optionalText(row.sex),
    ageMonths: ageMonths !== null && Number.isInteger(ageMonths) && ageMonths >= 0 ? ageMonths : null,
    pen: optionalText(row.pen),
  }
}

function mapBasisValues(value: unknown): Record<string, number | string> {
  const row = asRecord(value)
  return Object.fromEntries(Object.entries(row).filter((entry): entry is [string, number | string] =>
    typeof entry[1] === 'string' || (typeof entry[1] === 'number' && Number.isFinite(entry[1]))))
}

const lastNumericSourcePart = (sourceId: string | null): number | null => {
  if (!sourceId) return null
  const tail = sourceId.split(':').at(-1)
  if (!tail || !/^\d+$/.test(tail)) return null
  return positiveId(Number(tail))
}
const positiveSourcePart = (value: string | undefined): number | null =>
  value && /^\d+$/.test(value) ? positiveId(Number(value)) : null

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
  if (target.type === 'DEATH_VOUCHER') {
    return rule === 'REM-12' && sourceType?.toLowerCase() === 'herdexitvoucher' && lastNumericSourcePart(sourceId) === target.id
  }
  if (target.type === 'FEEDING_LOG') {
    return rule === 'REM-11' && sourceType?.toUpperCase() === 'PEN' && parts.length === 8 && parts[0] === 'PEN' && parts[2] === 'RATION'
      && parts[4] === 'DAY' && parts[6] === 'SESSION'
      && positiveSourcePart(parts[1]) === target.penId && parts[5] === target.date
      && positiveSourcePart(parts[7]) === target.sessionNo
  }
  return false
}

function reminderSourceAction(rule: string, sourceType: string | null, sourceId: string | null, target: ReminderTarget | null, cattleId: number | null, role: ViewerRole): { to: string | null; openLabel: string | null } {
  if (!target || target.cattleId !== null && cattleId !== null && target.cattleId !== cattleId) return { to: null, openLabel: null }

  if ((role === 'OWNER' || role === 'MANAGER') && target.type === 'HERD_ENTRY' && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.id !== null) {
    return { to: `/herd-entry/${target.id}`, openLabel: 'Xem phiếu nhập' }
  }
  if ((role === 'OWNER' || role === 'MANAGER') && target.type === 'DEATH_VOUCHER' && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.id !== null && target.code) {
    return { to: `/herd-exit/${target.id}`, openLabel: 'Xem phiếu' }
  }
  // REM-11 goes to every farm role (GBR-104, D41); only a Technician opens the log read-only.
  if (target.type === 'FEEDING_LOG'
      && sourceIdMatchesTarget(rule, sourceType, sourceId, target) && target.penId !== null && target.date && target.sessionNo !== null && target.code) {
    const query = new URLSearchParams({ date: target.date })
    if (role === 'TECHNICIAN') query.set('readOnly', '1')
    return { to: `/thuc-an/nhat-ky?${query.toString()}`, openLabel: 'Mở nhật ký cho ăn' }
  }
  return { to: null, openLabel: null }
}

const labelForKey = (key: string) => ({
  headAtEnd: 'Số bò cuối kỳ', entriesInPeriod: 'Nhập đàn trong kỳ', exitsInPeriod: 'Xuất đàn trong kỳ', entriesBySource: 'Nhập đàn theo nguồn', exitsByType: 'Xuất đàn theo loại', closedCasesByOutcome: 'Ca đóng theo kết quả',
  validWeighings: 'Lượt cân hợp lệ', averageGroupWeightKg: 'Cân trung bình theo nhóm', estimatedWeightCount: 'Lượt cân ước tính', averageADGKgPerDay: 'Tăng trọng bình quân ngày (kg/ngày)',
  doses: 'Mũi tiêm trong kỳ', onFarmVaccinations: 'Mũi tiêm tại trại', openedCases: 'Ca mở trong kỳ', movedToChronic: 'Ca chuyển theo dõi mạn tính', closedCases: 'Ca đóng trong kỳ',
  casesByOutcome: 'Ca theo kết quả', casesBySeverity: 'Ca theo mức độ', chronicAtEnd: 'Ca mạn tính cuối kỳ', treatments: 'Lượt điều trị', treatmentsByMedicine: 'Điều trị theo thuốc', cattleWithActiveMeatWithdrawalAtEnd: 'Bò đang ngưng thịt cuối kỳ',
  trackedFemales: 'Bò cái theo dõi', breedings: 'Lần phối', checks: 'Lần khám thai', calvings: 'Lần đẻ', liveCalves: 'Bê sinh sống', stillbirths: 'Chết lúc sinh', episodesLost: 'Thai mất', episodesCalved: 'Thai đã đẻ',
  averageCalvingIntervalDays: 'Khoảng cách lứa đẻ (ngày)', averageDaysOpen: 'Ngày trống trung bình', averageServicesPerConception: 'Số lần phối trên mỗi lần thụ thai', overallConceptionRate: 'Tỷ lệ thụ thai chung',
  firstServiceConceptionRate: 'Tỷ lệ thụ thai lần phối đầu', pregnancyLossRate: 'Tỷ lệ sẩy thai', averageAgeAtFirstCalvingMonths: 'Tuổi đẻ lứa đầu (tháng)', overdueFemales: 'Cái quá hạn thụ thai',
  entries: 'Nhập đàn', exits: 'Xuất đàn', penMoves: 'Lượt chuyển chuồng', averageHead: 'Đầu con bình quân', cattleIncluded: 'Bò đủ dữ liệu cân', insufficientWeights: 'Bò thiếu dữ liệu cân',
  cattleCount: 'Bò đủ dữ liệu cân', gainKg: 'Tổng tăng trọng (kg)', feedKg: 'Thức ăn đã dùng (kg)', feedCost: 'Chi phí thức ăn (đ)',
  feedKgForIncluded: 'Thức ăn tính tỷ lệ (bò đủ cân, kg)', feedCostForIncluded: 'Chi phí tính tỷ lệ (bò đủ cân, đ)',
  planned: 'Kế hoạch', done: 'Đã tiêm', deferred: 'Hoãn', overdue: 'Quá hạn', cancelled: 'Đã hủy',
  feedKgPerGain: 'Thức ăn trên mỗi kg tăng (kg/kg)', feedCostPerGain: 'Chi phí thức ăn trên mỗi kg tăng (đ/kg)',
  count: 'Số con',
  recordsWithoutWeight: 'Bản ghi VALID thiếu trọng lượng', estimatedCount: 'Lượt cân ước tính', estimatedShare: 'Tỷ lệ cân ước tính',
  adgKgPerDay: 'ADG (kg/ngày)', adgSampleSize: 'Số bò có ADG',
  averageStartWeightKg: 'Cân đầu kỳ (kg)', averageEndWeightKg: 'Cân cuối kỳ (kg)', totalGainKg: 'Tổng tăng trọng (kg)', averageAdgKgPerDay: 'ADG (kg/ngày)', feedUsedKg: 'Thức ăn đã dùng (kg)',
  feedPerKgGain: 'Thức ăn trên mỗi kg tăng (kg/kg)', feedCostPerKgGain: 'Chi phí thức ăn trên mỗi kg tăng (đ/kg)', targetReached: 'Đạt cân mục tiêu', projectedDaysToTarget: 'Số ngày dự kiến đến mục tiêu',
}[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (first) => first.toUpperCase()))

const formatValue = (value: unknown): string => {
  if (value == null) return 'Chưa có dữ liệu'
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  const record = asRecord(value)
  return Object.entries(record).map(([key, item]) => `${labelForKey(key)}: ${formatValue(item)}`).join(' · ')
}

function flattenSummary(summary: Record<string, unknown>): ReportView['tiles'] {
  const tiles: ReportView['tiles'] = []
  const visit = (key: string, value: unknown, parent = '') => {
    const label = [parent, labelForKey(key)].filter(Boolean).join(' · ')
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      tiles.push({ label, value: formatValue(value), note: value == null ? 'Chưa có dữ liệu' : '' })
      return
    }
    const record = asRecord(value)
    if (Object.hasOwn(record, 'value') || Object.hasOwn(record, 'n')) {
      const n = nullableNumber(record.n)
      const insufficient = textValue(record.status) === 'INSUFFICIENT_DATA' || (n !== null && n < 3)
      const numerator = nullableNumber(record.numerator)
      const denominator = nullableNumber(record.denominator)
      const ratioBasis = numerator !== null && denominator !== null ? `${formatValue(numerator)} / ${formatValue(denominator)}` : ''
      const sampleNote = n === null ? (textValue(record.status) || '') : `n = ${n}`
      tiles.push({
        label,
        value: insufficient ? 'Chưa đủ dữ liệu' : formatValue(record.value),
        note: [ratioBasis, sampleNote].filter(Boolean).join(' · '),
      })
      return
    }
    const entries = Object.entries(record)
    if (!entries.length) {
      tiles.push({ label, value: 'Chưa có dữ liệu', note: 'Chưa có dữ liệu' })
      return
    }
    entries.forEach(([child, childValue]) => visit(child, childValue, label))
  }
  Object.entries(summary).forEach(([key, value]) => visit(key, value))
  return tiles
}

function labelForRow(row: Record<string, unknown>) {
  const dimension = textValue(row.dimension)
  const value = textValue(row.value)
  if (dimension && value) {
    const dimensionLabel = ({ herdGroup: 'Nhóm đàn', pen: 'Chuồng', breed: 'Giống', purpose: 'Mục đích', lifeStage: 'Giai đoạn', schedule: 'Lịch tiêm', onFarmVaccine: 'Vắc-xin tại trại', caseOutcome: 'Kết quả ca', severity: 'Mức độ', treatmentMedicine: 'Thuốc điều trị', eventTypeAndResult: 'Sự kiện sinh sản', entrySource: 'Nguồn nhập đàn', exitType: 'Loại xuất đàn', penMoveTo: 'Chuồng chuyển đến' } as Record<string, string>)[dimension] ?? labelForKey(dimension)
    const displayValue = fromBackendGroup[value] ? HERD_GROUP_LABEL[fromBackendGroup[value]!] : value
    return `${dimensionLabel}: ${displayValue}`
  }
  const group = textValue(row.group)
  const pen = textValue(row.pen)
  const schedule = textValue(row.schedule)
  const label = textValue(row.label)
  if (label) return label
  if (group && pen) return `${fromBackendGroup[group] ? HERD_GROUP_LABEL[fromBackendGroup[group]!] : group} · chuồng ${pen}`
  if (pen) return `Chuồng ${pen}`
  if (group) return fromBackendGroup[group] ? HERD_GROUP_LABEL[fromBackendGroup[group]!] : group
  if (schedule) return schedule
  return 'Kết quả'
}

function formatReportDimension(value: string) {
  const group = fromBackendGroup[value]
  if (group) return HERD_GROUP_LABEL[group]
  if (Object.hasOwn(LIFE_STAGE_LABEL, value)) return LIFE_STAGE_LABEL[value as keyof typeof LIFE_STAGE_LABEL]
  return value
}

function mapReportSection(value: unknown): ReportSection {
  const rawSection = asRecord(value)
  const rawRows = requiredRows(rawSection.rows, 'sections.rows')
  const hidden = new Set(['dimension', 'value', 'pen', 'group', 'stage', 'schedule', 'label'])
  const rawTotal = rawSection.totalRow == null ? null : asRecord(rawSection.totalRow)
  if (rawTotal && (typeof rawTotal.cells !== 'object' || rawTotal.cells === null || Array.isArray(rawTotal.cells))) return failShape('sections.totalRow.cells')
  const totalCells = rawTotal ? asRecord(rawTotal.cells) : {}
  const keys = [...new Set([...rawRows.flatMap((item) => Object.keys(item)), ...Object.keys(totalCells)].filter((key) => !hidden.has(key)))]
  const rows = rawRows.map((item) => ({
    label: typeof item.label === 'string' ? formatReportDimension(item.label) : labelForRow(item),
    cells: Object.fromEntries(keys.map((key) => [key, formatValue(item[key])])),
  }))
  const totalRow = rawTotal ? {
    label: requiredString(rawTotal, 'label'),
    cells: Object.fromEntries(keys.map((key) => [key, formatValue(totalCells[key])])),
  } : null
  return {
    key: requiredString(rawSection, 'key'),
    title: requiredString(rawSection, 'title'),
    rowHeading: requiredString(rawSection, 'rowHeading'),
    columns: keys.map((key) => ({ key, label: labelForKey(key) })),
    rows,
    totalRow,
  }
}

function mapMetricChart(value: unknown): ReportMetricChart {
  const rawChart = asRecord(value)
  const unit = requiredString(rawChart, 'unit')
  const optionalNumber = (row: Record<string, unknown>, key: string) => row[key] == null ? null : requiredNumber(row, key)
  const bars = requiredRows(rawChart.bars, 'charts.bars').map((bar) => {
    const value = optionalNumber(bar, 'value')
    const sampleSize = optionalNumber(bar, 'sampleSize')
    const numerator = optionalNumber(bar, 'numerator')
    const denominator = optionalNumber(bar, 'denominator')
    if (sampleSize !== null && (!Number.isSafeInteger(sampleSize) || sampleSize < 0)) return failShape('charts.bars.sampleSize')
    if ((numerator === null) !== (denominator === null)) return failShape('charts.bars.ratio')
    if (numerator !== null && denominator !== null && (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || numerator > denominator)) return failShape('charts.bars.ratio')
    if (unit === '%' && value !== null && (value < 0 || value > 100)) return failShape('charts.bars.value')
    if (unit === '%' && (numerator === null || denominator === null || (denominator < 3) !== (value === null))) return failShape('charts.bars.ratio')
    return { label: formatReportDimension(requiredString(bar, 'label')), value, sampleSize, numerator, denominator }
  })
  return { title: requiredString(rawChart, 'title'), sub: requiredString(rawChart, 'sub'), unit, bars }
}

function mapReport(body: unknown, request: ReportRequest, timeZone: string): ReportView {
  const row = asRecord(body)
  const reportType = requiredString(row, 'reportType') as ReportRequest['reportType']
  const from = requiredString(row, 'from')
  const to = requiredString(row, 'to')
  const generatedAt = requiredString(row, 'generatedAt')
  if (typeof row.summary !== 'object' || row.summary === null || Array.isArray(row.summary)) failShape('summary')
  const summary = asRecord(row.summary)
  const rawRows = requiredRows(row.rows, 'rows')
  const hidden = new Set(['dimension', 'value', 'pen', 'group', 'stage', 'schedule', 'label'])
  const keys = [...new Set(rawRows.flatMap((item) => Object.keys(item).filter((key) => !hidden.has(key))))]
  const columns = keys.map((key) => ({ key, label: labelForKey(key) }))
  const rows = rawRows.map((item) => ({ label: labelForRow(item), cells: Object.fromEntries(keys.map((key) => [key, formatValue(item[key])])) }))
  let totalRow: ReportView['totalRow'] = null
  if (row.totalRow != null) {
    if (typeof row.totalRow !== 'object' || Array.isArray(row.totalRow)) return failShape('totalRow')
    const rawTotal = asRecord(row.totalRow)
    if (typeof rawTotal.cells !== 'object' || rawTotal.cells === null || Array.isArray(rawTotal.cells)) return failShape('totalRow.cells')
    const rawTotalCells = asRecord(rawTotal.cells)
    totalRow = { label: requiredString(rawTotal, 'label'), cells: Object.fromEntries(keys.map((key) => [key, formatValue(rawTotalCells[key])])) }
  }
  let chart: ReportView['chart'] = null
  if (row.chart != null) {
    const rawChart = asRecord(row.chart)
    const bars = requiredRows(rawChart.bars, 'chart.bars').map((bar) => {
      const value = nullableNumber(bar.value)
      const numerator = requiredNumber(bar, 'numerator')
      const denominator = requiredNumber(bar, 'denominator')
      if ((value !== null && (value < 0 || value > 100)) || !Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator || (denominator < 3) !== (value === null)) return failShape('chart.bars.value')
      return { label: requiredString(bar, 'label'), value, numerator, denominator }
    })
    chart = { title: requiredString(rawChart, 'title'), sub: requiredString(rawChart, 'sub'), bars }
  }
  const unavailableData = Array.isArray(row.unavailableData) ? row.unavailableData.filter((item): item is string => typeof item === 'string') : []
  const sections = row.sections == null ? [] : requiredRows(row.sections, 'sections').map(mapReportSection)
  const charts = row.charts == null ? [] : requiredRows(row.charts, 'charts').map(mapMetricChart)
  const title = REPORT_CATALOGUE.find((item) => item.code === reportType)?.title ?? reportType
  const allowed = new Set(REPORT_CATALOGUE.find((item) => item.code === reportType)?.filters ?? [])
  const filters = [
    allowed.has('pen') && request.pen ? `Chuồng ${request.pen}` : '',
    allowed.has('breed') && request.breed ? `Giống ${request.breed}` : '',
    allowed.has('group') && request.herdGroup ? HERD_GROUP_LABEL[request.herdGroup] : '',
    allowed.has('stage') && request.lifeStage ? LIFE_STAGE_LABEL[request.lifeStage] : '',
  ].filter(Boolean)
  const scope = [`${from} – ${to}`, ...filters].join(' · ')
  return { reportType, title, from, to, generatedAt, timeZone, scope, tiles: flattenSummary(summary), columns, rows, totalRow, chart, unavailableData, sections, charts }
}

function mapDashboard(body: unknown, pens: PenOption[], context: FarmContext, filters: DashboardFilters, days: number): DashboardView {
  const row = asRecord(body)
  const indicators = asRecord(row.indicators)
  const m01 = asRecord(indicators.M01)
  const m02 = asRecord(indicators.M02)
  const m03 = asRecord(indicators.M03)
  const m04 = asRecord(indicators.M04)
  const m05 = asRecord(indicators.M05)
  const m06 = asRecord(indicators.M06)
  const m07 = indicators.M07 == null ? null : asRecord(indicators.M07)
  const m08 = asRecord(indicators.M08)
  const m09 = asRecord(indicators.M09)
  const m01Count = requiredNumber(m01, 'count')
  if (typeof m01.byBreed !== 'object' || m01.byBreed === null || Array.isArray(m01.byBreed)) failShape('M01.byBreed')
  const breedBreakdown = Object.entries(asRecord(m01.byBreed)).map(([label, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return failShape(`M01.byBreed.${label}`)
    return { label, count: value }
  })
  const zebu = breedBreakdown.find((breed) => breed.label.toLocaleLowerCase('vi') === 'zebu đỏ')?.count ?? 0
  const sind = breedBreakdown.find((breed) => breed.label.toLocaleLowerCase('vi') === 'lai sind')?.count ?? 0
  const backendGroups = asRecord(m05.byHerdGroup)
  const groupRows = HERD_GROUP_ORDER.map((group) => {
    const backendKey = toBackendGroup[group]
    const value = backendGroups[backendKey]
    if (typeof value !== 'number' || !Number.isFinite(value)) return failShape(`M05.byHerdGroup.${backendKey}`)
    return { group, label: HERD_GROUP_LABEL[group], head: value, pregnant: group === 'BREEDING_FEMALE' ? requiredNumber(m05, 'pregnantBreedingFemales') : null }
  })
  const m06Groups = asRecord(m06.byHerdGroup)
  const byGroup = Object.entries(m06Groups).flatMap(([group, raw]) => {
    const mappedGroup = fromBackendGroup[group]
    const average = nullableNumber(asRecord(raw).averageKgPerDay)
    return mappedGroup && average !== null ? [{ label: HERD_GROUP_LABEL[mappedGroup], value: average }] : []
  })
  const adgSampleCount = requiredNumber(m06, 'sampleCount')
  const calvingInterval = asRecord(m09.averageCalvingInterval)
  const conceptionRate = asRecord(m09.overallConceptionRate)
  const m08ByPen = requiredRows(m08.byPen, 'M08.byPen')
  const m08Capacity = requiredNumber(m08, 'totalCapacity')
  const m08Head = requiredNumber(m08, 'totalHead')
  const hasBreakdownFilter = Boolean(filters.pen || filters.herdGroup || filters.lifeStage)
  const selectedPen = filters.pen ? m08ByPen.find((pen) => textValue(pen.code) === filters.pen) : undefined
  const m08Filtered = filters.herdGroup || filters.lifeStage ? null : filters.pen
    ? selectedPen && typeof selectedPen.head === 'number' && typeof selectedPen.capacity === 'number'
      ? { head: selectedPen.head, capacity: selectedPen.capacity, percent: selectedPen.capacity ? Math.round(selectedPen.head * 100 / selectedPen.capacity) : 0, fullPens: selectedPen.head >= selectedPen.capacity ? 1 : 0 }
      : null
    : { head: m08Head, capacity: m08Capacity, percent: m08Capacity ? Math.round(m08Head * 100 / m08Capacity) : 0, fullPens: m08ByPen.filter((pen) => typeof pen.head === 'number' && typeof pen.capacity === 'number' && pen.head >= pen.capacity).length }
  const attention = hasBreakdownFilter ? [] : requiredRows(row.attention, 'attention').map((item) => mapAttention(item))
  const activeCattle = requiredNumber(row, 'activeCattle')
  const serviceUntil = context.serviceUntil ? businessDate(new Date(parseBusinessTime(context.serviceUntil))) : ''
  const serviceStatus = requiredString(row, 'serviceStatus')
  const serviceStatusLabel = ({ ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Hết hạn', SUSPENDED: 'Tạm ngưng' } as Record<string, string>)[serviceStatus] ?? serviceStatus
  return {
    farmName: requiredString(row, 'farmName'), activeCattle, serviceStatus: serviceStatusLabel, serviceUntil,
    generatedAt: requiredString(row, 'generatedAt'), timeZone: context.timeZone, empty: m01Count === 0, pens,
    indicators: {
      m01: { total: m01Count, zebu, sind, breedBreakdown },
      m02: { total: requiredNumber(m02, 'attentionCount'), treating: requiredNumber(m02, 'underTreatment'), withdrawal: requiredNumber(m02, 'activeWithdrawal') },
      m03: { total: hasBreakdownFilter ? null : requiredNumber(m03, 'dueWithin7Days'), overdue: hasBreakdownFilter ? null : requiredNumber(m03, 'overdue') },
      m04: { total: requiredNumber(m04, 'within30Days'), within7: requiredNumber(m04, 'within7Days') },
      m05: { rows: groupRows, total: groupRows.reduce((total, group) => total + group.head, 0), pregnant: requiredNumber(m05, 'pregnantBreedingFemales') },
      m06: { value: nullableNumber(m06.averageKgPerDay), byGroup, days, unavailable: days < 14 ? 'PERIOD_TOO_SHORT' : adgSampleCount === 0 ? 'NO_DATA' : null },
      m07: m07 ? { total: requiredNumber(m07, 'overdueCount') } : null,
      m08: m08Filtered,
      m08Unavailable: filters.herdGroup || filters.lifeStage ? 'FILTER_NOT_SUPPORTED' : null,
      m09: {
        calvingIntervalDays: nullableNumber(calvingInterval.value), conceptionRate: nullableNumber(conceptionRate.value) === null ? null : nullableNumber(conceptionRate.value)! * 100,
        overdueFemales: requiredNumber(m09, 'overdueCount'), calvingIntervalN: requiredNumber(calvingInterval, 'n'), conceptionRateN: requiredNumber(conceptionRate, 'n'),
      },
    },
    attention, attentionUnavailable: hasBreakdownFilter,
  }
}

function mapAttention(row: Record<string, unknown>): DashboardView['attention'][number] {
  const type = requiredString(row, 'type')
  const code = textValue(row.displayCode, textValue(row.cattleCode, textValue(row.code, '—')))
  const cattleTarget = code !== '—' && typeof row.cattleId === 'number' ? `/cattle/${encodeURIComponent(code)}` : null
  const common = { code, pen: textValue(row.pen, '—'), group: undefined, stage: undefined, to: null as string | null }
  if (type === 'OVERDUE_VACCINATION') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Mũi tiêm quá hạn', status: 'Quá hạn', tone: 'err' }
  if (type === 'BREEDING_WINDOW') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Đang trong cửa sổ phối', status: 'Hôm nay', tone: 'warn' }
  if (type === 'PREGNANCY_CHECK_DUE') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Đến hạn khám thai', status: 'Đến hạn', tone: 'warn' }
  if (type === 'CALVING_WITHIN_7_DAYS') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Dự kiến đẻ trong 7 ngày', status: 'Sắp đẻ', tone: 'info' }
  if (type === 'CASE_OPENED_TODAY') return { ...common, kind: 'A01', to: cattleTarget, issue: 'Ca sức khỏe mới mở', status: 'Hôm nay', tone: 'info' }
  if (type === 'A02' || Object.hasOwn(row, 'calfOutcomeId')) return { ...common, code: textValue(row.damCode, code), kind: 'A02', to: null, issue: 'Bê nháp chờ xác nhận', status: 'Chờ xác nhận', tone: 'warn' }
  if (type === 'A03' || Object.hasOwn(row, 'voucherId')) return { ...common, code: textValue(row.code, '—'), kind: 'A03', to: null, issue: 'Phiếu chết chờ duyệt', status: 'Chờ xác nhận', tone: 'warn' }
  if (type === 'A04' || Object.hasOwn(row, 'targetKg')) return { ...common, kind: 'A04', to: cattleTarget, issue: typeof row.latestWeightKg === 'number' && typeof row.targetKg === 'number' ? `Đạt cân xuất chuồng · ${formatValue(row.latestWeightKg)} / ${formatValue(row.targetKg)} kg` : 'Đạt cân xuất chuồng', status: 'Đạt mục tiêu', tone: 'ok' }
  return failShape(`attention.type=${type}`)
}

function profileRoute(target: ReminderTarget | null, cattleId: number | null, cattleCode: string | null, role: ViewerRole): string | null {
  if (!target || target.type !== 'CATTLE_PROFILE' || target.id === null || target.id !== target.cattleId
      || target.id !== cattleId || !target.code || target.code !== cattleCode) return null
  const code = encodeURIComponent(target.code)
  return role === 'TECHNICIAN' ? `/kt/dan-bo/${code}` : `/cattle/${code}`
}

function mapReminder(row: Record<string, unknown>, index: number, role: ViewerRole): ReminderItem {
  const rule = requiredString(row, 'ruleType')
  const ruleInfo = reminderRules[rule]
  if (!ruleInfo) return failShape(`ruleType=${rule}`)
  const sourceRecord = optionalText(row.sourceRecord)
  const reminderId = nullableNumber(row.id)
  const sourceType = optionalText(row.sourceType)
  const sourceId = optionalText(row.sourceId)
  const cattleId = positiveId(row.cattleId)
  const cattle = mapCattleDetail(row.cattle)
  const cattleProfileTarget = mapReminderTarget(row.cattleProfileTarget)
  const sourceTarget = mapReminderTarget(row.sourceTarget)
  const sourceSummary = optionalText(row.sourceSummary)
  const dueTime = typeof row.dueTime === 'string' ? row.dueTime : ''
  const id = reminderId ?? `${rule}:${sourceRecord || String(cattleId ?? 'unknown')}:${dueTime}:${index}`
  const rawUrgency = requiredString(row, 'urgency') as Urgency
  if (!urgencies.has(rawUrgency)) return failShape(`urgency=${rawUrgency}`)
  const parameterVersion = nullableNumber(row.parameterVersion)
  const basisMissing = optionalText(row.basisMissing)
  const basisValues = mapBasisValues(row.basisValues)
  const action = sourceSummary
    ? reminderSourceAction(rule, sourceType, sourceId, sourceTarget, cattleId, role)
    : { to: null, openLabel: null }
  return {
    id, rule: `${rule} · ${ruleInfo.title}`, type: ruleInfo.type, title: ruleInfo.title,
    code: cattle.code, breed: cattle.breed, pen: cattle.pen,
    dueAt: dueTime || null, windowEnd: typeof row.windowEnd === 'string' ? row.windowEnd : undefined,
    highlighted: row.highlighted === true, basis: textValue(row.basisLabel) || null,
    basisMissing: basisMissing ?? undefined, parameterVersion,
    source: sourceSummary ?? (sourceRecord ? `Bản ghi nguồn ${sourceRecord}` : 'Chưa có dữ liệu nguồn'),
    to: action.to, openLabel: action.openLabel, urgency: rawUrgency, lifecycleStatus: 'ACTIVE',
    cattleId, sex: cattle.sex, ageMonths: cattle.ageMonths,
    sourceType, sourceId, sourceSummary,
    basisValues, cattleProfileTarget, sourceTarget,
    profileTo: profileRoute(cattleProfileTarget, cattleId, cattle.code, role),
  }
}

function mapGettingStarted(body: unknown): GettingStarted {
  const row = asRecord(body)
  const steps = requiredRows(row.steps, 'steps').map((stepRow) => {
    const serverStep = requiredString(stepRow, 'step')
    const step = frontendStep[serverStep]
    const definition = STEP_DEFS.find((item) => item.step === step)
    if (!step || !definition) return failShape(`step=${serverStep}`)
    return { step, label: definition.label, screen: definition.screen, done: stepRow.done === true, markable: stepRow.markable === true }
  })
  return { visible: row.visible === true, dismissed: row.dismissed === true, allDone: row.allDone === true, steps }
}

export function createFarmOverviewBackendApi({ farmId, transport }: { farmId: string | number; transport: BackendTransport }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  let contextPromise: Promise<FarmContext> | undefined
  let pensPromise: Promise<PenOption[]> | undefined
  let breedsPromise: Promise<BreedOption[]> | undefined

  const context = () => {
    contextPromise ??= transport.get(path('/context')).then((value) => {
      const row = asRecord(value)
      return { timeZone: FARM_TIME_ZONE_ID, serviceUntil: textValue(row.serviceUntil, textValue(row.currentPeriodUntil)) }
    }).catch((error: unknown) => { contextPromise = undefined; throw error })
    return contextPromise
  }

  const pens = () => {
    pensPromise ??= transport.get(path('/pens')).then((value) => {
      const body = asRecord(value)
      const rows = requiredRows(Array.isArray(value) ? value : body.pens, 'pens')
      return rows.map((row): PenOption => ({
        id: requiredNumber(row, 'id'), code: requiredString(row, 'code'), name: textValue(row.name, requiredString(row, 'code')),
        capacity: requiredNumber(row, 'capacity'),
      }))
    }).catch((error: unknown) => { pensPromise = undefined; throw error })
    return pensPromise
  }

  const breeds = () => {
    breedsPromise ??= transport.get(path('/catalogues/breeds')).then((value) => requiredRows(value, 'breeds').map((row): BreedOption => ({
      id: requiredNumber(row, 'id'), code: requiredString(row, 'code'), name: requiredString(row, 'name'),
    }))).catch((error: unknown) => { breedsPromise = undefined; throw error })
    return breedsPromise
  }

  return {
    async getDashboard(filters: DashboardFilters): Promise<DashboardView> {
      const validationError = validateFilters(filters)
      if (validationError) throw new Error(validationError)
      const [penOptions, farm] = await Promise.all([pens(), context()])
      const days = periodDays(filters)
      const to = filters.period === 'custom' ? filters.to! : businessDate()
      const from = filters.period === 'custom' ? filters.from! : addCalendarDays(to, 1 - days)
      const query = new URLSearchParams({ from, to })
      if (filters.pen) {
        const selected = penOptions.find((pen) => pen.code === filters.pen)
        if (!selected) throw new Error('Không tìm thấy chuồng đã chọn. Tải lại bộ lọc rồi thử lại.')
        query.set('penId', String(selected.id))
      }
      if (filters.herdGroup) query.set('herdGroup', toBackendGroup[filters.herdGroup])
      if (filters.lifeStage) query.set('lifeStage', filters.lifeStage)
      const body = await transport.get(path(`/dashboard?${query.toString()}`))
      return mapDashboard(body, penOptions, farm, filters, days)
    },
    async getGettingStarted(): Promise<GettingStarted> { return mapGettingStarted(await transport.get(path('/dashboard/getting-started'))) },
    async markStepDone(step: string): Promise<GettingStarted> {
      const code = backendStep[step]
      if (!code) throw new Error('Không tìm thấy bước hướng dẫn.')
      return mapGettingStarted(await transport.command(path(`/dashboard/getting-started/steps/${encodeURIComponent(code)}/done`), undefined, { method: 'POST' }))
    },
    async dismissGettingStarted(): Promise<GettingStarted> {
      return mapGettingStarted(await transport.command(path('/dashboard/getting-started/dismiss'), undefined, { method: 'POST' }))
    },
    async listReminders(role: ViewerRole): Promise<ReminderList> {
      const [body, farm] = await Promise.all([transport.get(path('/reminders')), context()])
      return { today: businessDate(), timeZone: farm.timeZone, items: requiredRows(body, 'reminders').map((row, index) => mapReminder(row, index, role)) }
    },
    async runReport(request: ReportRequest): Promise<ReportView> {
      const validationError = validateReportRequest(request)
      if (validationError) throw new Error(validationError)
      const catalogue = REPORT_CATALOGUE.find((item) => item.code === request.reportType)
      if (!catalogue) throw new Error('Loại báo cáo không hợp lệ.')
      const allowed = new Set(catalogue.filters)
      const [penOptions, breedOptions, farm] = await Promise.all([pens(), breeds(), context()])
      const pen = allowed.has('pen') && request.pen ? penOptions.find((item) => item.code === request.pen) : undefined
      if (allowed.has('pen') && request.pen && !pen) throw new Error('Không tìm thấy chuồng đã chọn. Tải lại bộ lọc rồi thử lại.')
      const breed = allowed.has('breed') && request.breed ? breedOptions.find((item) => item.name === request.breed || item.code === request.breed) : undefined
      if (allowed.has('breed') && request.breed && !breed) throw new Error('Không tìm thấy giống đã chọn. Tải lại bộ lọc rồi thử lại.')
      const body = {
        reportType: request.reportType, from: request.dateFrom, to: request.dateTo,
        penIds: pen ? [pen.id] : [], breedIds: breed ? [breed.id] : [],
        herdGroups: allowed.has('group') && request.herdGroup ? [toBackendGroup[request.herdGroup]] : [],
        lifeStages: allowed.has('stage') && request.lifeStage ? [request.lifeStage] : [],
      }
      const response = await transport.command(path('/dashboard/reports'), body, { method: 'POST' })
      return mapReport(response, request, farm.timeZone)
    },
    async listPenOptions(): Promise<PenInfo[]> { return (await pens()).map(({ id: _id, ...pen }) => pen) },
    async listBreedOptions(): Promise<Array<{ code: string; name: string }>> { return (await breeds()).map(({ code, name }) => ({ code, name })) },
  }
}
