import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationFormValues, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'

export const RATION_GROUPS = [
  { value: 'CALVES', label: 'Bê' },
  { value: 'FATTENING', label: 'Vỗ béo' },
  { value: 'BREEDING_BULLS', label: 'Đực giống' },
  { value: 'BREEDING_FEMALES', label: 'Bò cái sinh sản' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'OTHER', label: 'Khác' },
] as const

export const rationGroupLabel = (value: string) => (RATION_GROUPS.find((group) => group.value === value)?.label ?? value) || '—'

export function localRationDate(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

export function nextRationCode(rows: readonly FeedRation[]) {
  const next = Math.max(0, ...rows.map((row) => Number(row.rationCode.match(/^KP-(\d+)$/)?.[1] ?? 0))) + 1
  return `KP-${String(next).padStart(2, '0')}`
}

export function initialFeedRationForm(record: FeedRation | null): FeedRationFormValues {
  const next = localRationDate(1)
  // A scheduled version is edited in place (saving replaces it); every other version starts from tomorrow.
  const afterRecord = record?.effectiveFrom && record.effectiveFrom >= next ? record.effectiveFrom : next
  return {
    name: record?.name ?? '',
    herdGroup: record?.herdGroup ?? '',
    basis: record?.basis ?? '',
    effectiveFrom: afterRecord,
    sessionsPerDay: record?.sessionsPerDay ?? 2,
    sessionTimes: record ? [...Array.from({ length: record.sessionsPerDay }, (_, index) => ['06:30', '16:30', ''][index] ?? '')] : ['06:30', '16:30'],
    penIds: record ? [...record.penIds] : [],
    components: record
      ? record.components.map((component) => ({
        feedItemId: String(component.feedItemId),
        session1Kg: String(component.session1Kg),
        session2Kg: String(component.session2Kg),
        session3Kg: String(component.session3Kg),
      }))
      : [{ feedItemId: '', session1Kg: '0', session2Kg: '0', session3Kg: '0' }],
  }
}

export function validateFeedRationForm(
  values: FeedRationFormValues,
  feeds: readonly FeedStockRow[],
  pens: readonly FeedRationPenOption[],
): string | null {
  if (!values.name.trim()) return 'Nhập tên khẩu phần.'
  if (values.name.trim().length > 100) return 'Tên khẩu phần tối đa 100 ký tự.'
  if (values.herdGroup.length > 30) return 'Nhóm đàn tối đa 30 ký tự.'
  if (values.basis.length > 500) return 'Nguồn áp dụng tối đa 500 ký tự.'
  if (!isCalendarDate(values.effectiveFrom)) return 'Ngày áp dụng không hợp lệ.'
  if (values.effectiveFrom < localRationDate(1)) return 'Ngày áp dụng phải từ ngày mai trở đi.'
  if (![1, 2, 3].includes(values.sessionsPerDay) || values.sessionTimes.length !== values.sessionsPerDay) return 'Số cữ và thời gian chưa khớp.'
  if (values.sessionTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Nhập giờ cho từng cữ theo định dạng giờ:phút.'
  if (!values.penIds.length) return 'Chọn ít nhất một chuồng.'
  if (new Set(values.penIds).size !== values.penIds.length) return 'Mỗi chuồng chỉ được chọn một lần.'
  const activePenIds = new Set(pens.filter((pen) => pen.status === 'ACTIVE').map((pen) => pen.id))
  if (values.penIds.some((id) => !activePenIds.has(id))) return 'Chỉ chọn chuồng đang hoạt động.'
  if (!values.components.length) return 'Thêm ít nhất một loại thức ăn.'
  const seen = new Set<number>()
  for (const [index, component] of values.components.entries()) {
    if (!component.feedItemId) return `Chọn thức ăn dòng ${index + 1}.`
    const feedItemId = Number(component.feedItemId)
    if (!feeds.some((feed) => feed.feedItemId === feedItemId)) return `Chọn thức ăn đang hoạt động cho dòng ${index + 1}.`
    if (seen.has(feedItemId)) return 'Mỗi loại thức ăn chỉ được thêm một lần.'
    seen.add(feedItemId)
    const quantities = [component.session1Kg, component.session2Kg, component.session3Kg].map(Number)
    if (quantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) return `Lượng thức ăn dòng ${index + 1} phải là số không âm.`
    if (values.sessionsPerDay < 2 && quantities[1] > 0 || values.sessionsPerDay < 3 && quantities[2] > 0) return `Dòng ${index + 1} có lượng ở cữ chưa được chọn.`
    if (!quantities.slice(0, values.sessionsPerDay).some((quantity) => quantity > 0)) return 'Mỗi thức ăn cần có ít nhất một cữ lớn hơn 0.'
  }
  return null
}

export function toSaveFeedRationInput(values: FeedRationFormValues, rationCode?: string, replacesId?: number): SaveFeedRationInput {
  return {
    ...(rationCode ? { rationCode } : {}),
    ...(replacesId === undefined ? {} : { replacesId }),
    name: values.name,
    herdGroup: values.herdGroup,
    basis: values.basis,
    effectiveFrom: values.effectiveFrom,
    sessionsPerDay: values.sessionsPerDay,
    sessionTimes: [...values.sessionTimes],
    penIds: [...values.penIds],
    components: values.components.map((component) => ({
      feedItemId: Number(component.feedItemId),
      session1Kg: Number(component.session1Kg),
      session2Kg: Number(component.session2Kg),
      session3Kg: Number(component.session3Kg),
    })),
  }
}

export function previewFeedRation(values: FeedRationFormValues, feeds: readonly FeedStockRow[], pens: readonly FeedRationPenOption[]) {
  const activePens = pens.filter((pen) => values.penIds.includes(pen.id))
  const headcount = activePens.reduce((sum, pen) => sum + pen.headcount, 0)
  const lines = values.components.map((component) => {
    const feed = feeds.find((row) => row.feedItemId === Number(component.feedItemId))
    const session1Kg = Number(component.session1Kg) || 0
    const session2Kg = values.sessionsPerDay >= 2 ? Number(component.session2Kg) || 0 : 0
    const session3Kg = values.sessionsPerDay >= 3 ? Number(component.session3Kg) || 0 : 0
    const dailyKg = session1Kg + session2Kg + session3Kg
    const unitCost = feed && feed.onHandKg > 0 ? feed.stockValue / feed.onHandKg : null
    const dailyCost = unitCost === null ? null : Math.round(dailyKg * unitCost)
    const plannedForPens = dailyKg * headcount
    return { component, feed, session1Kg, session2Kg, session3Kg, dailyKg, dailyCost, plannedForPens,
      daysOfCover: feed && plannedForPens > 0 ? feed.onHandKg / plannedForPens : null }
  })
  const dailyKgPerHead = lines.reduce((sum, line) => sum + line.dailyKg, 0)
  const dailyCostPerHead = lines.every((line) => line.dailyCost !== null) ? lines.reduce((sum, line) => sum + (line.dailyCost ?? 0), 0) : null
  return {
    lines,
    headcount,
    dailyKgPerHead,
    dailyCostPerHead,
    plannedDailyKg: dailyKgPerHead * headcount,
    plannedDailyCost: dailyCostPerHead === null ? null : dailyCostPerHead * headcount,
  }
}

export type { FeedRation }
