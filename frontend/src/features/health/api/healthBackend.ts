import { asRecord, asRows, textValue } from '../../../shared/api/parse'
import { type BackendTransport } from '../../../shared/api/backendTransport'
import { dateOf } from '../domain/healthFormat'
import { caseDay, latestWithdrawalEnd, MSG } from '../domain/healthRules'
import { correctionTreatmentErrors, HealthValidationError, observationErrors, openCaseErrors, reasonErrors, statusErrors, textFieldErrors, treatmentErrors } from '../validation/healthValidation'
import { mapHealthError } from './healthError'
import {
  ageText, mapCattle, mapHealthCaseCard, mapHealthCaseResult, mapHealthCaseRow, mapMedicine, mapPendingExit, mapRecordResult, mapTimelineRow,
  mapTreatmentResult, num, nullableNum, pick, pickOptional, SEVERITIES, STATES, STATUSES, OUTCOMES, text, toFarmTime, toInstant,
  toObservationCorrectionRequest, toOpenCaseRequest, toStatusRequest, toTreatmentCorrectionRequest, toTreatmentRequest, toVoidRequest,
  type CaseRef, type EntryRef,
} from './healthMapper'
import type {
  CaseOutcome, CaseResultKind, CaseStatus, CorrectEntryCommand, EntryType, HealthCaseCard, HealthCaseFilters, HealthCaseList, HealthCaseResult,
  HealthCaseRow, HealthCattle, HealthFormOptions, HealthProfile, HealthState, HealthTimelineRow, Medicine, OpenCaseCommand, PendingExit, Progress, RecordResult,
  ReopenCaseCommand, Severity, StatusCommand, TreatmentCommand, TreatmentResult, TreatmentRoute, VoidEntryCommand,
} from '../types'

/**
 * Adapter FE-10 cho chế độ backend (không bao giờ đọc mock). Spec FE-10 §7:
 * A1 GET /health-cases · A2 GET /health-cases/cattle/{cattleId} · A3 POST /health-cases · A4 POST …/{caseId}/observations
 * · A5 POST …/{caseId}/status · A6 POST …/{caseId}/treatments · A7 POST /treatments/{id}/correction|void
 * · A8 POST /health-observations/{id}/correction|void. Kèm GET /cattle/resolve, /cattle/{id}, /members, /medicines, /pens.
 * Giờ gửi / nhận theo múi giờ trại (GET /context); lỗi backend đổi thành lỗi từng ô tiếng Việt (HealthValidationError).
 */
const LIST_SIZE = 200

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export function createHealthBackend({ farmId, transport, clock = () => new Date() }: { farmId: string | number | null; transport: BackendTransport; clock?: () => Date }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const now = () => toFarmTime(clock().toISOString())
  const resolved = new Map<string, { cattleId: number; cattle: HealthCattle }>()
  // Ca / bản ghi đã đọc qua A1, A2: để các lệnh A5–A8 biết mã ca, mã bò và loại bản ghi (route điều trị hay quan sát).
  const cases = new Map<number, CaseRef>()
  const entries = new Map<number, EntryRef>()
  let memberList: Array<{ id: number; name: string }> | undefined
  // Kiểm tra trước khi gửi bằng đúng quy tắc của chế độ local (spec FE-10 mục 6); quy tắc cần dữ liệu trại
  // chưa đọc được (thuốc ngừng dùng…) vẫn do backend kiểm và báo về đúng ô.
  const assertValid = (errors: Record<string, string>) => { if (Object.keys(errors).length) throw new HealthValidationError(errors) }
  const caseContext = (caseId: number) => {
    const ref = cases.get(caseId)
    return { now: now(), entryDate: ref ? resolved.get(ref.cattleCode)?.cattle.entryDate : undefined, openedAt: ref?.openedAt, latestAt: ref?.latestEntryAt }
  }

  async function run<T>(action: () => Promise<T>, timeField = 'observedAt'): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw mapHealthError(error, timeField)
    }
  }

  async function resolve(code: string) {
    const hit = resolved.get(code)
    if (hit) return hit
    const body = asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`)))
    const cattleId = num(body.cattleId)
    if (cattleId === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
    // /cattle/resolve không trả thông tin nhập đàn; hồ sơ chi tiết có ngày nhập đàn, ngày / loại xuất.
    const cattle = mapCattle(await transport.get(path(`/cattle/${cattleId}`)), now().slice(0, 10))
    if (!cattle.code) cattle.code = code
    const value = { cattleId, cattle }
    resolved.set(code, value)
    return value
  }

  const members = async () => {
    if (memberList) return memberList
    const response = await transport.get(path('/members'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).members ?? asRecord(response).items)
    memberList = rows.filter((m) => m.status === undefined || m.status === 'ACTIVE').map((m) => ({ id: num(m.userId) ?? num(m.id) ?? 0, name: textValue(m.fullName, textValue(m.email)), email: textValue(m.email) || undefined }))
    return memberList
  }
  /**
   * Người thực hiện điều trị nhập tự do (có thể là người ngoài): tên khớp đúng một thành viên → id; trùng họ tên hoặc
   * không khớp → gửi tên, để không gán nhầm người.
   */
  const memberId = async (name: string | undefined) => {
    const wanted = (name ?? '').trim()
    if (!wanted) return undefined
    const matches = (await members()).filter((m) => m.name === wanted)
    return matches.length === 1 ? matches[0].id : undefined
  }
  const performerBody = async (name: string | undefined) => {
    const id = await memberId(name)
    return id !== undefined ? { performerId: id } : { performerName: (name ?? '').trim() || null }
  }
  const pens = async () => {
    const response = await transport.get(path('/pens'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).pens)
    return rows.map((p) => ({ id: num(p.id) ?? 0, code: textValue(p.code), name: textValue(p.name, textValue(p.code)) }))
  }

  function mapRow(raw: unknown): HealthCaseRow {
    const row = mapHealthCaseRow(raw, now())
    cases.set(row.id, { caseCode: row.caseCode, cattleCode: row.cattleCode })
    return row
  }

  function result(raw: unknown, kind: CaseResultKind, fallback: CaseRef | undefined, deathVoucher: PendingExit | null = null): HealthCaseResult {
    const mapped = mapHealthCaseResult(raw, kind, fallback, deathVoucher)
    cases.set(mapped.id, { caseCode: mapped.caseCode, cattleCode: mapped.cattleCode })
    return mapped
  }

  function recordResult(raw: unknown, action: RecordResult['action'], entry: EntryRef): RecordResult {
    return mapRecordResult(raw, action, entry, cases.get(entry.caseId)?.cattleCode ?? '')
  }

  const entryOf = (entryId: number): EntryRef => {
    const entry = entries.get(entryId)
    if (!entry) throw new Error('Bản ghi chưa được tải. Vui lòng mở lại hồ sơ bò rồi thử lại.')
    return entry
  }

  const api = {
    now,

    // A1 + GET /pens (bộ lọc chuồng theo mã).
    async listCases(filters: HealthCaseFilters = {}): Promise<HealthCaseList> {
      return run(async () => {
        const penList = await pens()
        const penId = filters.penCode ? penList.find((p) => p.code === filters.penCode)?.id : undefined
        if (filters.penCode && penId === undefined) return { rows: [], counts: { open: 0, chronic: 0, closed: 0, all: 0 }, pens: penList }
        const body = asRecord(await transport.get(path(`/health-cases${query({
          tab: (filters.tab ?? 'open').toUpperCase(), search: filters.search?.trim(), severity: filters.severity || undefined, penId, from: filters.from, to: filters.to,
          sort: filters.sort, dir: filters.dir, page: 0, size: LIST_SIZE,
        })}`)))
        const counts = asRecord(body.counts)
        return {
          rows: asRows(body.items).map(mapRow),
          counts: { open: num(counts.open) ?? 0, chronic: num(counts.chronic) ?? 0, closed: num(counts.closed) ?? 0, all: num(counts.all) ?? 0 },
          pens: penList,
        }
      })
    },

    // A2 (+ GET /cattle/resolve, /cattle/{id} cho phần đầu hồ sơ).
    async getProfile(cattleCode: string, historyCaseId?: string): Promise<HealthProfile> {
      return run(async () => {
        const { cattleId, cattle } = await resolve(cattleCode)
        const query = historyCaseId ? `?${new URLSearchParams({ historyCaseId })}` : ''
        const body = asRecord(await transport.get(path(`/health-cases/cattle/${cattleId}${query}`)))
        const timeline: HealthTimelineRow[] = []
        const activeCases = asRows(body.openCases).map((raw): HealthCaseCard => {
          const mapped = mapHealthCaseCard(raw, cattleCode, now())
          for (const row of mapped.rows) entries.set(row.id, { type: row.type, caseId: mapped.card.id })
          timeline.push(...mapped.rows)
          cases.set(mapped.card.id, mapped.ref)
          return mapped.card
        })
        const previousCases = asRows(body.previousCases).map((raw): HealthCaseCard => {
          const mapped = mapHealthCaseCard(raw, cattleCode, now(), true)
          cases.set(mapped.card.id, mapped.ref)
          timeline.push(...mapped.rows)
          return mapped.card
        })
        timeline.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id - a.id)
        const pendingExit: PendingExit | null = body.pendingExit === null || body.pendingExit === undefined ? null : mapPendingExit(body.pendingExit, cattleCode)
        return {
          cattle, healthState: pick(STATES, body.healthState, 'HEALTHY'), withdrawalEndDate: text(body.withdrawalEndDate) ?? null, suspectedContagious: body.suspectedContagious === true,
          pendingExit, activeCases, previousCases, timeline,
        }
      })
    },

    // GET /medicines, /members và chẩn đoán đã dùng trong trại (gợi ý Q4) từ A1 tab ALL.
    async formOptions(): Promise<HealthFormOptions> {
      return run(async () => {
        const [medicineRows, memberRows, caseBody] = await Promise.all([
          transport.get(path('/medicines')), members(), transport.get(path(`/health-cases${query({ tab: 'ALL', from: '2000-01-01', to: now().slice(0, 10), page: 0, size: LIST_SIZE })}`)),
        ])
        const medicineList = Array.isArray(medicineRows) ? asRows(medicineRows) : asRows(asRecord(medicineRows).items)
        const diagnoses = [...new Set(asRows(asRecord(caseBody).items).map((c) => textValue(c.diagnosis)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
        return { medicines: medicineList.map(mapMedicine), members: memberRows, diagnoses }
      })
    },

    // A3
    async openCase(cattleCode: string, cmd: OpenCaseCommand): Promise<HealthCaseResult> {
      return run(async () => {
        const { cattle } = await resolve(cattleCode)
        assertValid(openCaseErrors(cmd, { now: now(), entryDate: cattle.entryDate }))
        const { cattleId } = await resolve(cattleCode)
        const r = await transport.command(path('/health-cases'), toOpenCaseRequest(cattleId, cmd))
        return result(r, 'OPENED', { caseCode: '', cattleCode })
      })
    },

    // A6
    async recordTreatment(caseId: number, cmd: TreatmentCommand): Promise<TreatmentResult> {
      return run(async () => {
        assertValid(treatmentErrors(cmd, caseContext(caseId)))
        const r = asRecord(await transport.command(path(`/health-cases/${caseId}/treatments`), toTreatmentRequest({
          expectedVersion: cmd.expectedVersion, medicineId: cmd.medicineId, treatmentTime: cmd.treatmentTime, dose: cmd.dose, route: cmd.route,
          courseDays: cmd.courseDays, withdrawalDays: cmd.withdrawalDays, performerBody: await performerBody(cmd.performer), veterinaryAdvice: cmd.veterinaryAdvice,
          returnToOpen: cmd.returnToOpen,
        })))
        return mapTreatmentResult(r, caseId, cases.get(caseId)?.caseCode ?? '', cmd.courseDays)
      }, 'treatmentTime')
    },

    // A5
    async updateStatus(caseId: number, cmd: StatusCommand): Promise<HealthCaseResult> {
      const closing = cmd.action === 'CLOSE'
      return run(async () => {
        assertValid(statusErrors(cmd, caseContext(caseId)))
        // D35 / D54: gửi đúng diễn biến người dùng chọn; backend báo MSG-COM-06 nếu phần theo dõi thiếu mô tả hoặc diễn biến.
        const r = asRecord(await transport.command(path(`/health-cases/${caseId}/status`), toStatusRequest(cmd)))
        const kind: CaseResultKind = cmd.action === 'TO_CHRONIC' ? 'CHRONIC' : cmd.action === 'TO_OPEN' ? 'REOPENED' : closing ? 'CLOSED' : 'KEPT'
        const ref = cases.get(caseId)
        const voucherId = num(r.pendingExitVoucherId)
        const deathVoucher: PendingExit | null = voucherId === undefined ? null : {
          id: voucherId, cattleCode: textValue(r.cattleCode, ref?.cattleCode), caseCode: textValue(r.caseCode, ref?.caseCode), type: cmd.outcome === 'MISSING' ? 'OTHER' : 'DEATH',
          reason: cmd.outcome === 'MISSING' ? 'Mất tích' : 'Chết', date: dateOf(text(r.closedAt) ? toFarmTime(r.closedAt) : cmd.observedAt), reportedBy: (await members()).find((m) => m.id === cmd.confirmedById)?.name ?? '', status: 'PENDING',
        }
        return result(r, kind, ref, deathVoucher)
      })
    },

    // A7 / A8 sửa: route theo loại bản ghi đã đọc ở A2.
    async correctEntry(entryId: number, cmd: CorrectEntryCommand): Promise<RecordResult> {
      const entry = entryOf(entryId)
      const treatment = entry.type === 'TREATMENT'
      return run(async () => {
        const ctx = caseContext(entry.caseId)
        assertValid({
          ...reasonErrors(cmd.reason),
          // Chỉ kiểm các trường người dùng gửi lên; trường để nguyên lấy theo bản ghi cũ ở backend.
          ...(treatment
            ? correctionTreatmentErrors(cmd, ctx)
            : {
                ...observationErrors('Thời điểm quan sát', { time: cmd.observedAt ?? ctx.now, temperatureC: cmd.temperatureC }, { now: ctx.now, entryDate: cmd.observedAt ? ctx.entryDate : undefined }),
                ...(cmd.description === undefined ? {} : textFieldErrors('description', entry.type === 'OPENING' ? 'Dấu hiệu / mô tả' : 'Mô tả', cmd.description, 1000)),
              }),
        })
        const body = treatment
          ? toTreatmentCorrectionRequest({ ...cmd, performerBody: cmd.performer === undefined ? undefined : await performerBody(cmd.performer) })
          : toObservationCorrectionRequest(cmd)
        const r = await transport.command(path(treatment ? `/treatments/${entryId}/correction` : `/health-observations/${entryId}/correction`), body)
        return recordResult(r, 'CORRECTED', entry)
      }, treatment ? 'treatmentTime' : 'observedAt')
    },

    // A7 / A8 hủy.
    // A5b (D58): mở lại ca đã đóng; ca Chết / Mất tích thì backend bác luôn phiếu chờ xác nhận.
    async reopenCase(caseId: number, cmd: ReopenCaseCommand): Promise<HealthCaseResult> {
      assertValid(reasonErrors(cmd.reason))
      return run(async () => result(await transport.command(path(`/health-cases/${caseId}/reopen`), toVoidRequest(cmd)), 'RESUMED', cases.get(caseId)))
    },

    async voidEntry(entryId: number, cmd: VoidEntryCommand): Promise<RecordResult> {
      const entry = entryOf(entryId)
      if (entry.type === 'OPENING') throw new Error(MSG.voidOpening)
      assertValid(reasonErrors(cmd.reason))
      return run(async () => {
        const r = await transport.command(path(entry.type === 'TREATMENT' ? `/treatments/${entryId}/void` : `/health-observations/${entryId}/void`), toVoidRequest(cmd))
        return recordResult(r, 'VOIDED', entry)
      })
    },
  }
  return api
}

export type HealthBackend = ReturnType<typeof createHealthBackend>

// Compatibility exports for existing characterization tests and feature code.
// Ownership now lives in the dedicated mapper/error modules.
export { mapHealthError } from './healthError'
export { mapCattle, mapMedicine, mapTimelineRow, toFarmTime, toInstant, toRoute } from './healthMapper'
