// Input validation moved out of src/features/feed-stock/data/feedRationForm.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { FeedStockRow } from '../types'
import type { FeedRationFormValues, FeedRationPenOption } from '../types/feedRation'
import { localRationDate } from '../domain/feedRationForm'

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
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
