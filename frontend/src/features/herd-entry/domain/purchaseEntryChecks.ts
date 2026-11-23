import { businessDate } from '../../../shared/lib/date/farmTime'
import type { Pen } from '../../pen-management'
import type { EntryCow } from '../types'

type CheckStatus = 'ok' | 'warn' | 'error' | 'pending'
export type PurchaseEntryCheck = { id: string; label: string; status: CheckStatus; detail?: string }
type PurposeOption = { id?: number; purposeType?: string }
type Input = {
  cows: EntryCow[]
  pricing: 'kg' | 'con'
  date: string
  pens: Pen[]
  quarantine: string
  today?: string
  purposes?: PurposeOption[]
}

const tagKey = (tag: string) => tag.trim().toLocaleLowerCase('en-US')
const purposeType = (cow: EntryCow, purposes: PurposeOption[]) => {
  const matched = purposes.find((option) => option.id === Number(cow.purposeId))
  if (matched?.purposeType) return matched.purposeType
  if (/sinh sản/i.test(cow.purpose)) return 'BREEDING'
  if (/vỗ béo|thương phẩm/i.test(cow.purpose)) return 'FATTENING'
  if (/đực giống|giữ giống/i.test(cow.purpose)) return 'SIRE'
  return ''
}

export function evaluatePurchaseEntryChecks(input: Input) {
  const today = input.today ?? businessDate()
  const tags = input.cows.map((cow) => cow.tag.trim()).filter(Boolean).map(tagKey)
  const duplicateTag = new Set(tags).size !== tags.length
  const invalidEntryDate = !input.date || input.date > today || input.cows.some((cow) =>
    Boolean(cow.dob && cow.dobAccuracy !== 'UNKNOWN' && cow.dob.slice(0, 10) > input.date),
  )
  const incoming = new Map<string, number>()
  input.cows.forEach((cow) => incoming.set(cow.barn, (incoming.get(cow.barn) ?? 0) + 1))
  const capacityErrors = [...incoming].some(([code, count]) => {
    const pen = input.pens.find((item) => item.code === code)
    return !pen || pen.status !== 'ACTIVE' || pen.count + count > pen.capacity
  })
  const fullPens = [...incoming].filter(([code, count]) => {
    const pen = input.pens.find((item) => item.code === code)
    return pen?.status === 'ACTIVE' && pen.count + count === pen.capacity
  }).map(([code]) => code)
  const criteriaReasons = (cow: EntryCow) => {
    const pen = input.pens.find((item) => item.code === cow.barn)
    const criteria = pen?.receptionCriteria
    const reasons = cow.warningReason ? [String(cow.warningReason)] : []
    if (!pen || !criteria) return reasons
    const purpose = purposeType(cow, input.purposes ?? [])
    const stage = /bê theo mẹ|chưa cai/i.test(cow.stage) ? 'UNWEANED_CALF' : /bê cai sữa/i.test(cow.stage) ? 'WEANED_CALF' : /bò tơ|hậu bị/i.test(cow.stage) ? 'YOUNG_STOCK' : /bò|vỗ béo|đực giống/i.test(cow.stage) ? 'ADULT' : ''
    const sex = cow.sex === 'Đực' ? 'MALE' : cow.sex === 'Cái' ? 'FEMALE' : ''
    const age = cow.dob && cow.dobAccuracy !== 'UNKNOWN' ? Math.max(0, (Number(input.date.slice(0, 4)) - Number(cow.dob.slice(0, 4))) * 12 + Number(input.date.slice(5, 7)) - Number(cow.dob.slice(5, 7))) : null
    if (criteria.purposeTypes?.length && purpose && !criteria.purposeTypes.includes(purpose)) reasons.push('Không đạt mục đích tiếp nhận của chuồng.')
    if (criteria.lifeStages?.length && stage && !criteria.lifeStages.includes(stage)) reasons.push('Không đạt giai đoạn tiếp nhận của chuồng.')
    if (criteria.sex && sex && criteria.sex !== sex) reasons.push('Không đạt giới tính tiếp nhận của chuồng.')
    if (criteria.minAgeMonths != null && age != null && age < criteria.minAgeMonths) reasons.push(`Tuổi dưới mức tối thiểu ${criteria.minAgeMonths} tháng.`)
    if (criteria.minWeightKg != null && input.pricing === 'kg' && cow.weight < criteria.minWeightKg) reasons.push(`Cân dưới mức tối thiểu ${criteria.minWeightKg} kg.`)
    return reasons
  }
  const criteriaWarnings = input.cows.some((cow) => criteriaReasons(cow).length > 0)
  const noWeight = input.pricing === 'kg' && input.cows.some((cow) => !Number.isFinite(Number(cow.weight)) || cow.weight <= 0)
  const checks: PurchaseEntryCheck[] = [
    { id: 'farm-tags', label: 'Thẻ tai trong trại', status: input.cows.length ? 'pending' : 'pending', detail: 'Kiểm tra khi lưu' },
    { id: 'voucher-tags', label: 'Thẻ tai không trùng trong phiếu', status: duplicateTag ? 'error' : input.cows.length ? 'ok' : 'pending' },
    { id: 'capacity', label: input.cows.length ? 'Sức chứa chuồng nhận' : 'Chưa có con nào', status: !input.cows.length ? 'pending' : capacityErrors ? 'error' : fullPens.length ? 'warn' : 'ok', detail: fullPens.length ? `Chuồng ${fullPens.join(', ')} sẽ đầy` : undefined },
    { id: 'dates', label: 'Ngày nhập hợp lệ theo hiện tại và tháng sinh', status: input.cows.length ? invalidEntryDate ? 'error' : 'ok' : 'pending' },
    { id: 'criteria', label: 'Tiêu chí chuồng nhận', status: !input.cows.length ? 'pending' : criteriaWarnings ? 'warn' : 'ok' },
    { id: 'weight', label: 'Cân nhập theo kg', status: !input.cows.length || input.pricing !== 'kg' ? 'pending' : noWeight ? 'warn' : 'ok', detail: input.pricing !== 'kg' ? 'Không yêu cầu khi tính theo con' : undefined },
    { id: 'quarantine', label: 'Giấy kiểm dịch', status: !input.cows.length ? 'pending' : input.quarantine.trim() ? 'ok' : 'warn', detail: input.cows.length && !input.quarantine.trim() ? 'MSG-FE06-24 · Có thể bổ sung sau' : undefined },
  ]
  return {
    checks,
    warningsByLine: Object.fromEntries(input.cows.flatMap((cow, index) => {
      const warnings = [
        ...criteriaReasons(cow),
        input.pricing === 'kg' && (!Number.isFinite(Number(cow.weight)) || cow.weight <= 0) ? 'Chưa có cân khi tính theo kg.' : '',
      ].filter(Boolean)
      return warnings.length ? [[index, warnings]] : []
    })),
    hasDuplicateTags: duplicateTag,
    invalidEntryDate,
  }
}
