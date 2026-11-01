import type {
  CalvingCommand,
  ReproductiveStatus,
  ReproductionCommand,
  ReproductionFemale,
  WorklistFilters,
} from '../types'

export type ReproductionAction =
  | 'RECORD_ESTRUS'
  | 'RECORD_BREEDING'
  | 'RECORD_PREGNANCY_CHECK'
  | 'RECORD_PREGNANCY_UPDATE'
  | 'RECORD_CALVING'

const STATUS_ACTIONS: Record<ReproductiveStatus, ReproductionAction[]> = {
  AWAITING_BREEDING: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
  IN_ESTRUS: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
  BRED: ['RECORD_ESTRUS', 'RECORD_PREGNANCY_CHECK', 'RECORD_CALVING'],
  PREGNANT: ['RECORD_PREGNANCY_CHECK', 'RECORD_PREGNANCY_UPDATE', 'RECORD_CALVING'],
  POST_CALVING: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
}

export function actionsForStatus(status: ReproductiveStatus | null): ReproductionAction[] {
  return status ? [...STATUS_ACTIONS[status]] : []
}

export function filterWorklist(rows: readonly ReproductionFemale[], filters: WorklistFilters): ReproductionFemale[] {
  const query = filters.query?.trim().toLocaleLowerCase('vi')
  return rows.filter((row) => {
    if (!row.applicable || row.herdStatus !== 'ACTIVE' || !row.status) return false
    if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.penCode && filters.penCode !== 'ALL' && row.penCode !== filters.penCode) return false
    if (filters.breed && filters.breed !== 'ALL' && row.breed !== filters.breed) return false
    if (filters.eligibility && filters.eligibility !== 'ALL' && row.eligibility?.status !== filters.eligibility) return false
    if (query) {
      const haystack = [row.cattleCode, row.name, row.earTag, row.breed, row.penCode, row.penName]
        .join(' ').toLocaleLowerCase('vi')
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export const REPRODUCTION_STATUSES: ReproductiveStatus[] = [
  'AWAITING_BREEDING', 'IN_ESTRUS', 'BRED', 'PREGNANT', 'POST_CALVING',
]

export function statusCounts(rows: readonly ReproductionFemale[]): Record<ReproductiveStatus, number> {
  return Object.fromEntries(REPRODUCTION_STATUSES.map((status) => [
    status,
    rows.filter((row) => row.applicable && row.herdStatus === 'ACTIVE' && row.status === status).length,
  ])) as Record<ReproductiveStatus, number>
}

const occurredAtError = (value: string, today: string): string | null => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Nhập thời điểm sự kiện hợp lệ.'
  if (value > today) return 'Thời điểm sự kiện không được ở tương lai.'
  return null
}

export function validateReproductionCommand(
  command: ReproductionCommand,
  context: { today: string; profile: ReproductionFemale },
): string[] {
  const errors: string[] = []
  const dateError = occurredAtError(command.occurredAt, context.today)
  if (dateError) errors.push(dateError)
  if (context.profile.herdStatus !== 'ACTIVE') errors.push('Chỉ ghi sự kiện cho bò đang nuôi.')
  if (context.profile.sex && context.profile.sex !== 'FEMALE') errors.push('Sự kiện sinh sản chỉ áp dụng cho bò cái.')

  if (command.type === 'BREEDING') {
    if (command.linkedEstrusId) {
      const estrus = context.profile.events.find((event) => event.id === command.linkedEstrusId && event.type === 'ESTRUS' && event.status === 'VALID')
      if (estrus && command.occurredAt < estrus.occurredAt) errors.push('Ngày phối không được trước sự kiện động dục đã chọn.')
    }
    if (command.method === 'NATURAL_SERVICE' && command.sireSource === 'FARM' && !command.farmSireId?.trim()) {
      errors.push('Chọn bò đực giống trong trại.')
    }
    if (command.sireSource === 'EXTERNAL' && !command.externalSireBreed?.trim()) {
      errors.push('Nhập giống bò đực hoặc giống tinh ngoài trại.')
    }
    if (command.method === 'ARTIFICIAL_INSEMINATION' && command.sireSource === 'FARM' && !command.farmSireId?.trim()) {
      errors.push('Chọn bò đực giống trong trại.')
    }
    if (command.semenCode && command.semenCode.length > 50) errors.push('Mã lô tinh tối đa 50 ký tự.')
    if (command.performer && command.performer.length > 100) errors.push('Người thực hiện tối đa 100 ký tự.')
  }

  if (command.type === 'PREGNANCY_CHECK') {
    if (command.estimatedMonths != null && (!Number.isInteger(command.estimatedMonths) || command.estimatedMonths < 1 || command.estimatedMonths > 9)) {
      errors.push('Số tháng mang thai phải từ 1 đến 9.')
    }
    if (command.result !== 'PREGNANT' && command.estimatedMonths != null) errors.push('Chỉ nhập số tháng khi kết quả là Có thai.')
    if (command.linkedBreedingId) {
      const breeding = context.profile.events.find((event) => event.id === command.linkedBreedingId && event.type === 'BREEDING' && event.status === 'VALID')
      if (breeding && command.occurredAt < breeding.occurredAt) errors.push('Ngày khám thai không được trước lần phối đã chọn.')
    }
    if (command.note && command.note.length > 500) errors.push('Ghi chú tối đa 500 ký tự.')
  }

  if (command.type === 'PREGNANCY_UPDATE') {
    if (!context.profile.openPregnancy) errors.push('Không có thai kỳ đang mở để ghi diễn biến.')
    else if (command.occurredAt < context.profile.openPregnancy.confirmedAt) errors.push('Diễn biến thai không được trước ngày xác nhận có thai.')
    if (!command.details.trim()) errors.push('Nhập chi tiết diễn biến.')
    if (command.details.length > 1000) errors.push('Chi tiết tối đa 1.000 ký tự.')
    if (command.updateType !== 'COMPLICATION' && command.linkedHealthCaseId) errors.push('Chỉ liên kết ca sức khỏe khi ghi biến chứng.')
  }

  if (command.type === 'ESTRUS' && command.description && command.description.length > 1000) {
    errors.push('Mô tả tối đa 1.000 ký tự.')
  }

  return errors
}

export function validateCalving(
  command: CalvingCommand,
  context: { today: string; existingEarTags: readonly string[]; openPregnancyId?: string | null; openPregnancyConfirmedAt?: string | null },
): string[] {
  const errors: string[] = []
  const dateError = occurredAtError(command.birthAt, context.today)
  if (dateError) errors.push(dateError)
  if (context.openPregnancyId && command.pregnancyId && context.openPregnancyId !== command.pregnancyId) {
    errors.push('Thai kỳ đã thay đổi. Tải lại hồ sơ trước khi lưu.')
  }
  if (context.openPregnancyId && context.openPregnancyConfirmedAt && command.birthAt < context.openPregnancyConfirmedAt) {
    errors.push('Thời điểm đẻ không được trước ngày xác nhận có thai.')
  }
  if (command.calves.length < 1 || command.calves.length > 4) errors.push('Sự kiện đẻ cần từ 1 đến 4 bê.')

  const knownTags = new Set(context.existingEarTags.map((tag) => tag.trim().toLocaleLowerCase('vi')).filter(Boolean))
  for (const [index, calf] of command.calves.entries()) {
    const calfNo = index + 1
    if (calf.outcome === 'LIVE') {
      if (calf.sex === 'UNKNOWN') errors.push(`Bê sống ${calfNo}: chọn giới tính.`)
      if (!calf.penId) errors.push(`Bê sống ${calfNo}: chọn chuồng nuôi đầu tiên.`)
      if (!calf.registration) errors.push(`Bê sống ${calfNo}: chọn cách đăng ký.`)
      if (calf.registration === 'REGISTER_NOW' && !calf.productionPurpose) errors.push(`Bê sống ${calfNo}: chọn mục đích nuôi.`)
      const tag = calf.earTag?.trim()
      if (tag) {
        if (tag.length > 50) errors.push(`Số tai bê ${calfNo}: tối đa 50 ký tự.`)
        const normalized = tag.toLocaleLowerCase('vi')
        if (knownTags.has(normalized)) errors.push(`Số tai ${tag} đã được sử dụng.`)
        knownTags.add(normalized)
      }
    }
    if (calf.weightKg != null) {
      if (!Number.isFinite(calf.weightKg) || calf.weightKg < 1 || calf.weightKg > 80) errors.push(`Bê ${calfNo}: cân nặng phải từ 1 đến 80 kg.`)
      if (!calf.weightBasis) errors.push(`Bê ${calfNo}: chọn cơ sở cân.`)
    }
  }
  return errors
}

