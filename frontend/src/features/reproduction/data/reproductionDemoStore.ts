import { actionsForStatus, validateCalving, validateReproductionCommand } from '../domain/reproductionRules'
import type {
  CalfOutcome,
  CalvingCommand,
  CalvingRecord,
  OpenPregnancy,
  ReproductionCommand,
  ReproductionEvent,
  ReproductionFemale,
  ReproductionRevision,
  ReproductionRole,
} from '../types'
import { REPRODUCTION_DEMO } from './reproductionMock'

export interface ReproductionDemoStore {
  list(): Promise<ReproductionFemale[]>
  get(cattleCode: string): Promise<ReproductionFemale>
  recordEvent(cattleCode: string, command: ReproductionCommand, role: ReproductionRole): Promise<ReproductionFemale>
  recordCalving(cattleCode: string, command: CalvingCommand, role: ReproductionRole): Promise<ReproductionFemale>
  correctEvent(cattleCode: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  voidEvent(cattleCode: string, eventId: string, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  correctCalving(cattleCode: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  voidCalving(cattleCode: string, calvingId: string, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  reset(): Promise<ReproductionFemale[]>
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const localNow = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
const addDays = (value: string, days: number): string => {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 16)
}
const addHours = (value: string, hours: number): string => {
  const date = new Date(value)
  date.setHours(date.getHours() + hours)
  return date.toISOString().slice(0, 16)
}
const makeId = (kind: string, n: number) => `${kind}-${Date.now().toString(36)}-${n.toString(36)}`
const requireManager = (role: ReproductionRole) => {
  if (role !== 'MANAGER') throw new Error('Chỉ Quản lý mới được ghi, sửa hoặc hủy sự kiện sinh sản.')
}
const requiredReason = (reason: string) => {
  if (!reason.trim()) throw new Error('Nhập lý do sửa hoặc hủy.')
  if (reason.length > 500) throw new Error('Lý do tối đa 500 ký tự.')
}

function calculateExpectedDate(bredAt: string): string {
  return addDays(bredAt, 283)
}

function makeOpenPregnancy(event: ReproductionEvent, profile: ReproductionFemale): OpenPregnancy {
  return {
    id: event.pregnancyId ?? `pregnancy-${event.id}`,
    pregnancyNumber: profile.parity + 1,
    linkedBreedingId: event.linkedBreedingId ?? null,
    confirmedAt: event.occurredAt,
    expectedCalvingAt: event.expectedCalvingAt ?? null,
    expectedDateBasis: event.expectedDateBasis ?? null,
    estimatedMonths: event.estimatedMonths ?? null,
    status: 'OPEN',
  }
}

function deriveState(profile: ReproductionFemale, parityBaseline: number): void {
  const validCalvings = profile.calvings.filter((item) => item.status === 'VALID')
  profile.parity = parityBaseline + validCalvings.length
  const history = [
    ...profile.events,
    ...profile.calvings.map((calving): ReproductionEvent => ({
      id: calving.id, type: 'CALVING', occurredAt: calving.birthAt, recordedAt: calving.recordedAt,
      recorder: calving.recorder, status: calving.status, summary: 'Sự kiện đẻ',
      pregnancyId: calving.pregnancyId, version: calving.version,
    })),
  ].filter((item) => item.status === 'VALID').sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  let status: ReproductionFemale['status'] = 'AWAITING_BREEDING'
  let openPregnancy: OpenPregnancy | null = null
  let statusAt: string | null = null
  for (const item of history) {
    if (item.type === 'ESTRUS') {
      if (!openPregnancy) status = 'IN_ESTRUS'
      statusAt = item.occurredAt
    } else if (item.type === 'BREEDING') {
      if (!openPregnancy) status = 'BRED'
      statusAt = item.occurredAt
    } else if (item.type === 'PREGNANCY_CHECK') {
      if (item.result === 'PREGNANT') {
        openPregnancy = makeOpenPregnancy(item, profile)
        status = 'PREGNANT'
        statusAt = item.occurredAt
      } else if (item.result === 'NOT_PREGNANT') {
        openPregnancy = null
        status = 'AWAITING_BREEDING'
        statusAt = item.occurredAt
      }
    } else if (item.type === 'PREGNANCY_UPDATE' && item.updateType === 'LOSS') {
      openPregnancy = null
      status = 'AWAITING_BREEDING'
      statusAt = item.occurredAt
    } else if (item.type === 'CALVING') {
      openPregnancy = null
      status = 'POST_CALVING'
      statusAt = item.occurredAt
    }
  }
  profile.status = status
  profile.statusAt = statusAt
  profile.openPregnancy = openPregnancy
  profile.lastCalvingAt = profile.calvings.filter((item) => item.status === 'VALID').sort((a, b) => b.birthAt.localeCompare(a.birthAt))[0]?.birthAt ?? null
  const lastCalvingAt = profile.lastCalvingAt
  profile.servicesInCurrentCycle = history.filter((item) => item.type === 'BREEDING' && (!lastCalvingAt || item.occurredAt > lastCalvingAt)).length
  const latestEstrus = history.filter((item) => item.type === 'ESTRUS').slice(-1)[0]
  const latestBreeding = history.filter((item) => item.type === 'BREEDING').slice(-1)[0]
  if (status === 'IN_ESTRUS' && latestEstrus) {
    profile.breedingWindow = { from: addHours(latestEstrus.occurredAt, 8), to: addHours(latestEstrus.occurredAt, 12) }
    profile.nextAction = 'Theo dõi cửa sổ phối giống'
    profile.dueAt = profile.breedingWindow.from
  } else if (status === 'BRED' && latestBreeding) {
    profile.breedingWindow = null
    profile.nextAction = 'Chờ đến ngày khám thai'
    profile.dueAt = addDays(latestBreeding.occurredAt, 28)
  } else if (status === 'PREGNANT') {
    profile.breedingWindow = null
    profile.nextAction = 'Theo dõi thai kỳ và ngày đẻ dự kiến'
    profile.dueAt = profile.openPregnancy?.expectedCalvingAt ?? null
  } else if (status === 'POST_CALVING' && profile.lastCalvingAt) {
    profile.breedingWindow = null
    profile.nextAction = 'Theo dõi hồi phục sau sinh'
    profile.dueAt = addDays(profile.lastCalvingAt, 45)
  } else {
    profile.breedingWindow = null
    profile.nextAction = 'Theo dõi chu kỳ động dục'
    profile.dueAt = null
  }
  profile.indicators.daysSinceLastCalving = profile.lastCalvingAt
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.lastCalvingAt).getTime()) / 86_400_000))
    : null
  profile.events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  profile.calvings.sort((a, b) => b.birthAt.localeCompare(a.birthAt))
}

function actionFor(command: ReproductionCommand): 'RECORD_ESTRUS' | 'RECORD_BREEDING' | 'RECORD_PREGNANCY_CHECK' | 'RECORD_PREGNANCY_UPDATE' {
  return {
    ESTRUS: 'RECORD_ESTRUS',
    BREEDING: 'RECORD_BREEDING',
    PREGNANCY_CHECK: 'RECORD_PREGNANCY_CHECK',
    PREGNANCY_UPDATE: 'RECORD_PREGNANCY_UPDATE',
  }[command.type] as 'RECORD_ESTRUS' | 'RECORD_BREEDING' | 'RECORD_PREGNANCY_CHECK' | 'RECORD_PREGNANCY_UPDATE'
}

export function createReproductionDemoStore(
  seed: readonly ReproductionFemale[] = REPRODUCTION_DEMO,
  clock: () => string = localNow,
): ReproductionDemoStore {
  let rows = clone([...seed])
  const parityBaselines = new Map(rows.map((profile) => [
    profile.cattleCode,
    profile.parity - profile.calvings.filter((item) => item.status === 'VALID').length,
  ]))
  rows.forEach((profile) => deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity))
  let sequence = 0
  let revisionSequence = 0

  const find = (cattleCode: string) => {
    const profile = rows.find((row) => row.cattleCode === cattleCode)
    if (!profile) throw new Error(`Không tìm thấy hồ sơ sinh sản của ${cattleCode}.`)
    return profile
  }
  const copy = (profile: ReproductionFemale) => clone(profile)
  const addRevision = (
    profile: ReproductionFemale,
    eventId: string,
    before: Partial<ReproductionEvent | CalvingRecord>,
    after: Partial<ReproductionEvent | CalvingRecord>,
    reason: string,
    role: ReproductionRole,
  ) => {
    const revision: ReproductionRevision = {
      id: makeId('revision', ++revisionSequence), eventId, reason: reason.trim(), changedAt: clock(),
      changedBy: role === 'MANAGER' ? 'Trần Quốc Long' : role, before: clone(before), after: clone(after),
    }
    profile.revisions.unshift(revision)
  }

  return {
    async list() { return clone(rows) },
    async get(cattleCode) { return copy(find(cattleCode)) },
    async recordEvent(cattleCode, command, role) {
      requireManager(role)
      const profile = find(cattleCode)
      const available = actionsForStatus(profile.status)
      const moreAction = command.type === 'PREGNANCY_CHECK' && ['YOUNG_STOCK', 'ADULT'].includes(profile.lifeStage)
      if (!available.includes(actionFor(command)) && !moreAction) throw new Error('Hành động này không phù hợp với trạng thái sinh sản hiện tại.')
      const now = clock()
      const errors = validateReproductionCommand(command, { today: now, profile })
      if (errors.length) throw new Error(errors[0])

      const id = makeId('repro', ++sequence)
      const base: ReproductionEvent = {
        id, type: command.type, occurredAt: command.occurredAt, recordedAt: now,
        recorder: 'Trần Quốc Long', status: 'VALID', dataSource: command.dataSource ?? 'DIRECT_OBSERVATION',
        summary: '', details: '', version: 1,
      }
      let nextStatus = profile.status
      if (command.type === 'ESTRUS') {
        base.summary = 'Động dục'
        base.details = command.signs?.join(' · ') || command.description || 'Chưa có mô tả dấu hiệu'
        base.observer = command.observer
        nextStatus = 'IN_ESTRUS'
      } else if (command.type === 'BREEDING') {
        const sire = command.sireSource === 'FARM' ? command.farmSireId : command.externalSireBreed
        base.summary = command.method === 'NATURAL_SERVICE' ? 'Phối giống · tự nhiên' : 'Phối giống · thụ tinh nhân tạo'
        base.details = [sire, command.semenCode && `Lô tinh ${command.semenCode}`, command.note].filter(Boolean).join(' · ')
        base.method = command.method
        base.performer = command.performer
        base.sireLabel = sire
        base.linkedEstrusId = command.linkedEstrusId ?? null
        base.expectedCalvingAt = calculateExpectedDate(command.occurredAt)
        base.expectedDateBasis = 'TENTATIVE'
        nextStatus = 'BRED'
      } else if (command.type === 'PREGNANCY_CHECK') {
        base.summary = `Khám thai · ${{ PREGNANT: 'Có thai', NOT_PREGNANT: 'Không có thai', INCONCLUSIVE: 'Chưa kết luận' }[command.result]}`
        base.details = [command.method, command.examiner, command.note].filter(Boolean).join(' · ')
        base.result = command.result
        base.method = command.method
        base.examiner = command.examiner
        base.linkedBreedingId = command.linkedBreedingId ?? null
        base.estimatedMonths = command.estimatedMonths ?? null
        if (command.result === 'PREGNANT') {
          const linkedBreeding = profile.events.find((event) => event.id === command.linkedBreedingId && event.type === 'BREEDING')
          const expected = linkedBreeding?.occurredAt
            ? calculateExpectedDate(linkedBreeding.occurredAt)
            : command.estimatedMonths != null
              ? addDays(command.occurredAt, 283 - command.estimatedMonths * 30)
              : null
          base.pregnancyId = makeId('pregnancy', sequence)
          base.expectedCalvingAt = expected
          base.expectedDateBasis = linkedBreeding ? 'CONFIRMED' : expected ? 'ESTIMATED' : null
          nextStatus = 'PREGNANT'
        } else if (command.result === 'NOT_PREGNANT') {
          nextStatus = 'AWAITING_BREEDING'
        }
      } else {
        base.summary = `Diễn biến thai · ${{ OBSERVATION: 'Theo dõi', COMPLICATION: 'Biến chứng', LOSS: 'Mất thai' }[command.updateType]}`
        base.details = command.details
        base.updateType = command.updateType
        base.pregnancyId = profile.openPregnancy?.id ?? null
        base.linkedHealthCaseId = command.linkedHealthCaseId ?? null
        if (command.updateType === 'LOSS') nextStatus = 'AWAITING_BREEDING'
      }
      profile.events.unshift(base)
      profile.status = nextStatus
      profile.statusAt = base.occurredAt
      if (command.type === 'PREGNANCY_CHECK' && command.result === 'PREGNANT') profile.openPregnancy = makeOpenPregnancy(base, profile)
      if ((command.type === 'PREGNANCY_CHECK' && command.result === 'NOT_PREGNANT') || (command.type === 'PREGNANCY_UPDATE' && command.updateType === 'LOSS')) profile.openPregnancy = null
      deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity)
      profile.version++
      return copy(profile)
    },
    async recordCalving(cattleCode, command, role) {
      requireManager(role)
      const profile = find(cattleCode)
      if (profile.status !== 'BRED' && profile.status !== 'PREGNANT' && !['YOUNG_STOCK', 'ADULT'].includes(profile.lifeStage)) {
        throw new Error('Không thể ghi sự kiện đẻ cho bò này.')
      }
      const tags = [
        ...rows.map((row) => row.earTag),
        ...rows.flatMap((row) => row.calvings.flatMap((calving) => calving.calves.map((calf) => calf.earTag ?? ''))),
      ]
      const errors = validateCalving(command, {
        today: clock(), existingEarTags: tags, openPregnancyId: profile.openPregnancy?.id,
        openPregnancyConfirmedAt: profile.openPregnancy?.confirmedAt,
      })
      if (errors.length) throw new Error(errors[0])
      const now = clock()
      const id = makeId('calving', ++sequence)
      const calves: CalfOutcome[] = command.calves.map((calf, index): CalfOutcome => {
        const live = calf.outcome === 'LIVE'
        const choice = live ? calf.registration ?? 'DRAFT' : null
        return {
          id: makeId('calf', ++sequence), number: index + 1, outcome: calf.outcome, sex: calf.sex,
          weightKg: calf.weightKg ?? null, weightBasis: calf.weightBasis ?? null,
          earTag: calf.earTag?.trim() || null, penId: live ? calf.penId ?? null : null,
          penCode: live ? calf.penCode ?? null : null, breed: live ? calf.breed ?? null : null,
          registrationChoice: choice,
          registrationStatus: choice === 'REGISTER_NOW' ? 'REGISTERED' : choice === 'DRAFT' ? 'PENDING_CONFIRMATION' : null,
          productionPurpose: choice === 'REGISTER_NOW' ? calf.productionPurpose ?? 'UNDECIDED' : null,
        }
      })
      const calving: CalvingRecord = {
        id, birthAt: command.birthAt, recordedAt: now, recorder: 'Trần Quốc Long', attendant: command.attendant,
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', pregnancyId: command.pregnancyId ?? null,
        course: command.course, damCondition: command.damCondition, retainedPlacenta: command.retainedPlacenta,
        calves, status: 'VALID', version: 1,
      }
      profile.calvings.unshift(calving)
      profile.events.unshift({
        id, type: 'CALVING', occurredAt: command.birthAt, recordedAt: now, recorder: 'Trần Quốc Long',
        status: 'VALID', dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', summary: 'Sự kiện đẻ',
        details: `${command.course} · ${calves.filter((calf) => calf.outcome === 'LIVE').length} bê sống · ${calves.filter((calf) => calf.outcome === 'STILLBORN').length} thai chết lưu`,
        pregnancyId: command.pregnancyId ?? null, version: 1,
      })
      profile.openPregnancy = null
      profile.status = 'POST_CALVING'
      profile.statusAt = command.birthAt
      profile.lastCalvingAt = command.birthAt
      deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity)
      profile.version++
      return copy(profile)
    },
    async correctEvent(cattleCode, eventId, patch, reason, role) {
      requireManager(role)
      requiredReason(reason)
      const profile = find(cattleCode)
      const item = profile.events.find((event) => event.id === eventId)
      if (!item) throw new Error('Không tìm thấy sự kiện cần sửa.')
      if (item.status !== 'VALID') throw new Error('Sự kiện đã hủy, không thể sửa.')
      if (patch.occurredAt && (Number.isNaN(Date.parse(patch.occurredAt)) || patch.occurredAt > clock())) throw new Error('Thời điểm sự kiện không được ở tương lai.')
      if (item.type === 'BREEDING' && profile.events.some((event) => event.type === 'PREGNANCY_CHECK' && event.status === 'VALID' && event.linkedBreedingId === eventId)) {
        throw new Error('Không thể sửa vì đã có khám thai liên quan.')
      }
      if (item.type === 'PREGNANCY_CHECK' && item.result === 'PREGNANT' && patch.result && patch.result !== 'PREGNANT') {
        const hasDependentUpdate = profile.events.some((event) => event.status === 'VALID' && event.type === 'PREGNANCY_UPDATE' && event.pregnancyId === item.pregnancyId)
        const hasDependentCalving = profile.calvings.some((calving) => calving.status === 'VALID' && calving.pregnancyId === item.pregnancyId)
        if (hasDependentUpdate || hasDependentCalving) throw new Error('Không thể sửa kết quả khám thai vì đã có diễn biến hoặc sự kiện đẻ liên quan.')
      }
      const before = clone(item)
      Object.assign(item, patch, { corrected: true, version: item.version + 1 })
      if (item.type === 'ESTRUS') item.summary = 'Động dục'
      if (item.type === 'BREEDING') {
        item.summary = item.method === 'NATURAL_SERVICE' ? 'Phối giống · tự nhiên' : 'Phối giống · thụ tinh nhân tạo'
        item.expectedCalvingAt = calculateExpectedDate(item.occurredAt)
        item.expectedDateBasis = 'TENTATIVE'
      }
      if (item.type === 'PREGNANCY_CHECK') {
        const resultLabel = { PREGNANT: 'Có thai', NOT_PREGNANT: 'Không có thai', INCONCLUSIVE: 'Chưa kết luận' }
        item.summary = `Khám thai · ${item.result ? resultLabel[item.result] : 'Chưa kết luận'}`
        if (item.result === 'PREGNANT') {
          item.pregnancyId ??= `pregnancy-${item.id}`
          const linkedBreeding = profile.events.find((event) => event.id === item.linkedBreedingId && event.type === 'BREEDING' && event.status === 'VALID')
          item.expectedCalvingAt = linkedBreeding
            ? calculateExpectedDate(linkedBreeding.occurredAt)
            : item.estimatedMonths != null
              ? addDays(item.occurredAt, 283 - item.estimatedMonths * 30)
              : null
          item.expectedDateBasis = linkedBreeding ? 'CONFIRMED' : item.expectedCalvingAt ? 'ESTIMATED' : null
        } else {
          item.expectedCalvingAt = null
          item.expectedDateBasis = null
        }
      }
      if (item.type === 'PREGNANCY_UPDATE') {
        const updateLabel = { OBSERVATION: 'Theo dõi', COMPLICATION: 'Biến chứng', LOSS: 'Mất thai' }
        item.summary = `Diễn biến thai · ${item.updateType ? updateLabel[item.updateType] : 'Theo dõi'}`
      }
      addRevision(profile, eventId, before, clone(item), reason, role)
      deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity)
      profile.version++
      return copy(profile)
    },
    async voidEvent(cattleCode, eventId, reason, role) {
      requireManager(role)
      requiredReason(reason)
      const profile = find(cattleCode)
      const item = profile.events.find((event) => event.id === eventId)
      if (!item) throw new Error('Không tìm thấy sự kiện cần hủy.')
      if (item.status !== 'VALID') throw new Error('Sự kiện đã hủy.')
      if (item.type === 'BREEDING' && profile.events.some((event) => event.type === 'PREGNANCY_CHECK' && event.status === 'VALID' && event.linkedBreedingId === eventId)) {
        throw new Error('Không thể hủy vì đã có khám thai liên quan.')
      }
      if (item.type === 'PREGNANCY_CHECK' && profile.events.some((event) => event.status === 'VALID' && event.pregnancyId === item.pregnancyId && event.type === 'PREGNANCY_UPDATE')) {
        throw new Error('Không thể hủy vì thai kỳ đã có diễn biến liên quan.')
      }
      const calving = profile.calvings.find((row) => row.id === eventId)
      if (calving?.calves.some((calf) => calf.registrationStatus === 'REGISTERED')) throw new Error('Không thể hủy sự kiện đẻ đã đăng ký bê thành bò.')
      const before = calving ? clone(calving) : clone(item)
      item.status = 'VOIDED'
      item.voidReason = reason.trim()
      item.version++
      if (calving) { calving.status = 'VOIDED'; calving.voidReason = reason.trim(); calving.version++ }
      addRevision(profile, eventId, before, calving ? clone(calving) : clone(item), reason, role)
      deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity)
      profile.version++
      return copy(profile)
    },
    async correctCalving(cattleCode, calvingId, patch, reason, role) {
      requireManager(role)
      requiredReason(reason)
      const profile = find(cattleCode)
      const calving = profile.calvings.find((row) => row.id === calvingId)
      if (!calving) throw new Error('Không tìm thấy sự kiện đẻ cần sửa.')
      if (calving.status !== 'VALID') throw new Error('Sự kiện đẻ đã hủy, không thể sửa.')
      if (patch.calves && calving.calves.some((calf) => calf.registrationStatus === 'REGISTERED')) {
        throw new Error('Không thể sửa kết quả bê đã đăng ký thành bò.')
      }
      const nextBirthAt = patch.birthAt ?? calving.birthAt
      if (Number.isNaN(Date.parse(nextBirthAt)) || nextBirthAt > clock()) throw new Error('Thời điểm đẻ không được ở tương lai.')
      const pregnancyCheck = calving.pregnancyId
        ? profile.events.find((event) => event.type === 'PREGNANCY_CHECK' && event.status === 'VALID' && event.pregnancyId === calving.pregnancyId && event.result === 'PREGNANT')
        : undefined
      if (pregnancyCheck && nextBirthAt < pregnancyCheck.occurredAt) throw new Error('Thời điểm đẻ không được trước ngày xác nhận có thai.')
      if (patch.calves) {
        const existingTags = rows.flatMap((row) => [
          row.earTag,
          ...row.calvings.filter((item) => item.id !== calvingId).flatMap((item) => item.calves.map((calf) => calf.earTag ?? '')),
        ])
        const command: CalvingCommand = {
          birthAt: nextBirthAt,
          pregnancyId: patch.pregnancyId === undefined ? calving.pregnancyId : patch.pregnancyId,
          course: patch.course ?? calving.course,
          damCondition: patch.damCondition ?? calving.damCondition,
          retainedPlacenta: patch.retainedPlacenta ?? calving.retainedPlacenta,
          calves: patch.calves.map((calf) => ({
            outcome: calf.outcome,
            sex: calf.sex,
            weightKg: calf.weightKg,
            weightBasis: calf.weightBasis,
            earTag: calf.earTag ?? undefined,
            penId: calf.penId ?? undefined,
            penCode: calf.penCode ?? undefined,
            breed: calf.breed ?? undefined,
            registration: calf.registrationChoice ?? undefined,
            productionPurpose: calf.productionPurpose ?? undefined,
          })),
        }
        const errors = validateCalving(command, { today: clock(), existingEarTags: existingTags })
        if (errors.length) throw new Error(errors[0])
      }
      const before = clone(calving)
      Object.assign(calving, patch, { corrected: true, version: calving.version + 1 })
      const timeline = profile.events.find((event) => event.id === calvingId)
      if (timeline) {
        if (patch.birthAt) timeline.occurredAt = patch.birthAt
        if (patch.dataSource) timeline.dataSource = patch.dataSource
        if (patch.pregnancyId !== undefined) timeline.pregnancyId = patch.pregnancyId
        timeline.details = `${calving.course} · ${calving.calves.filter((calf) => calf.outcome === 'LIVE').length} bê sống · ${calving.calves.filter((calf) => calf.outcome === 'STILLBORN').length} thai chết lưu`
        timeline.corrected = true
        timeline.version++
      }
      addRevision(profile, calvingId, before, clone(calving), reason, role)
      deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity)
      profile.version++
      return copy(profile)
    },
    async voidCalving(cattleCode, calvingId, reason, role) {
      return this.voidEvent(cattleCode, calvingId, reason, role)
    },
    async reset() {
      rows = clone([...seed])
      rows.forEach((profile) => deriveState(profile, parityBaselines.get(profile.cattleCode) ?? profile.parity))
      sequence = 0
      revisionSequence = 0
      return clone(rows)
    },
  }
}

export const reproductionDemoStore = createReproductionDemoStore()

