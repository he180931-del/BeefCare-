import { asRecord, asRows, textValue } from '../../../shared/api/parse'
import { type BackendTransport } from '../../../shared/api/backendTransport'
import { fromFarmLocal, toFarmLocal } from '../../../shared/lib/date/farmTime'
import { validateReproductionCommand } from '../domain/reproductionRules'
import { backendId, mapProfile, mapWorklistItem, num, text } from './reproductionMapper'
import { mapReproductionError } from './reproductionError'
import { METHOD_OUT, ROLE_TEXT, SIGN_CODE, query, rowsOf } from './reproductionDto'
import type { CalvingCommand, CalvingRecord, ReproductionCommand, ReproductionEvent, ReproductionFemale, ReproductionFormOptions } from '../types'

// Compatibility exports keep existing feature consumers on the stable backend facade.
export { mapCalving, mapEligibility, mapProfile, mapTimelineRow, mapWorklistItem, NEXT_ACTION_TEXT, resolveReproductionSource } from './reproductionMapper'
export { ReproductionDuplicateError, mapReproductionError } from './reproductionError'
export { SIGN_CODE } from './reproductionDto'

/**
 * Adapter FE-11 / FE-12 cho chế độ backend (không bao giờ đọc mock). Spec FE-11 §7 A1–A6, FE-12 §7 A1–A8:
 * A1 GET /reproduction-worklist · A2 GET /cattle/{id}/reproduction-history · A3 POST /cattle/{id}/estrus-events
 * · A4 POST …/breeding-events · FE-12 A2 POST …/pregnancy-checks · A3 POST /pregnancy-episodes/{id}/updates · A4 POST /calvings
 * · sửa / hủy: /reproduction-events/{id}, /pregnancy-updates/{id}, /calvings/{id}, /calf-outcomes/{id} + /correction | /void.
 * Lựa chọn của popup: /members, /cattle?sex=MALE, /catalogues/breeds, /pens, /catalogues/production-purposes, /health-cases/cattle/{id}.
 * Giờ theo múi giờ trại; mỗi lệnh có Idempotency-Key (transport) và version của bản ghi; lỗi → tiếng Việt, theo từng ô.
 */

interface Cached { cattleId: number; profile?: ReproductionFemale }

/** Endpoint facade: owns transport orchestration while DTO, mapping, and errors live in sibling modules. */
export function createReproductionBackend({ farmId, transport }: { farmId: string | number | null; transport: BackendTransport }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const cache = new Map<string, Cached>()
  let options: Omit<ReproductionFormOptions, 'healthCases'> & { breedIds: Map<string, number>; memberIds: Map<string, number> } | undefined

  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw mapReproductionError(error)
    }
  }
  const instant = (local: string) => fromFarmLocal(local)

  async function cattleId(code: string): Promise<number> {
    const hit = cache.get(code)
    if (hit) return hit.cattleId
    const id = num(asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`))).cattleId)
    if (id === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
    cache.set(code, { cattleId: id })
    return id
  }
  async function profile(code: string): Promise<ReproductionFemale> {
    const id = await cattleId(code)
    const loaded = mapProfile(await transport.get(path(`/cattle/${id}/reproduction-history`)))
    cache.set(code, { cattleId: id, profile: loaded })
    return loaded
  }
  async function known(code: string): Promise<ReproductionFemale> {
    return cache.get(code)?.profile ?? profile(code)
  }

  async function catalogue() {
    if (options) return options
    const [membersBody, siresBody, breedsBody, pensBody, purposesBody] = await Promise.all([
      transport.get(path('/members')), transport.get(path(`/cattle${query({ sex: 'MALE', herdStatus: 'ACTIVE', size: 200 })}`)),
      transport.get(path('/catalogues/breeds')), transport.get(path('/pens')), transport.get(path('/catalogues/production-purposes')),
    ])
    const members = rowsOf(membersBody, 'members', 'items').filter((m) => m.status === undefined || m.status === 'ACTIVE')
      .map((m) => ({ id: String(num(m.userId) ?? num(m.id) ?? ''), name: textValue(m.fullName, textValue(m.email)), role: ROLE_TEXT[textValue(m.role)] ?? textValue(m.role) }))
    const breeds = rowsOf(breedsBody, 'items').filter((b) => b.available !== false).map((b) => ({ id: num(b.id) ?? 0, name: textValue(b.name, textValue(b.code)) }))
    options = {
      members, externalPeople: [],
      sires: rowsOf(siresBody, 'items').map((c) => {
        const code = textValue(c.code, textValue(c.displayCode))
        return { id: String(num(c.id) ?? ''), label: [text(c.name), code, text(c.earTagNumber) ?? text(c.earTag)].filter(Boolean).join(' · ') }
      }),
      breeds: breeds.map((b) => b.name),
      pens: rowsOf(pensBody, 'pens', 'items').filter((p) => p.status === undefined || p.status === 'ACTIVE')
        .map((p) => ({ id: String(num(p.id) ?? ''), code: textValue(p.code), label: `${textValue(p.code)} – ${textValue(p.name, textValue(p.code))}` })),
      purposes: rowsOf(purposesBody, 'items').filter((p) => p.available !== false)
        .map((p) => ({ value: String(num(p.id) ?? ''), type: textValue(p.purposeType), label: textValue(p.name, textValue(p.code)) })),
      breedIds: new Map(breeds.map((b) => [b.name, b.id])),
      memberIds: new Map(members.map((m) => [m.name, Number(m.id)])),
    }
    return options
  }
  /** Tên trong ô "thành viên hoặc người ngoài": khớp thành viên ACTIVE → id, ngược lại là tên ngoài (P1). */
  async function person(name: string | undefined, idKey: string, nameKey: string): Promise<Record<string, unknown>> {
    const value = name?.trim()
    if (!value) return {}
    const id = (await catalogue()).memberIds.get(value)
    return id ? { [idKey]: id } : { [nameKey]: value }
  }
  const breedId = async (name: string | undefined) => (name ? (await catalogue()).breedIds.get(name) : undefined)

  async function eventCommand(code: string, command: ReproductionCommand): Promise<void> {
    const current = await known(code)
    const id = await cattleId(code)
    if (command.type === 'ESTRUS') {
      await transport.command(path(`/cattle/${id}/estrus-events`), {
        expectedCattleVersion: current.version, observedAt: instant(command.occurredAt), ...await person(command.observer, 'observerId', 'observerName'),
        signs: (command.signs ?? []).map((sign) => SIGN_CODE[sign] ?? sign), description: command.description?.trim() || null,
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', confirmDuplicate: command.confirmDuplicate === true,
      })
    } else if (command.type === 'BREEDING') {
      const internal = command.sireSource === 'FARM'
      const breed = internal ? undefined : command.externalSireBreed?.trim()
      const sireBreedId = await breedId(breed)
      await transport.command(path(`/cattle/${id}/breeding-events`), {
        expectedCattleVersion: current.version, bredAt: instant(command.occurredAt), dataSource: command.dataSource ?? 'DIRECT_OBSERVATION',
        method: METHOD_OUT[command.method] ?? command.method, sireSource: internal ? 'INTERNAL' : 'EXTERNAL',
        sireCattleId: internal ? num(command.farmSireId) ?? null : null, sireBreedId: sireBreedId ?? null, sireBreed: sireBreedId ? null : breed || null,
        semenCode: command.semenCode?.trim() || null, semenSupplier: command.semenSupplier?.trim() || null,
        ...await person(command.performer, 'performerId', 'performerName'), linkedEstrusId: backendId(command.linkedEstrusId, 'event') ?? null,
        note: command.note?.trim() || null, confirmDuplicate: command.confirmDuplicate === true,
      })
    } else if (command.type === 'PREGNANCY_CHECK') {
      await transport.command(path(`/cattle/${id}/pregnancy-checks`), {
        expectedCattleVersion: current.version, linkedBreedingId: backendId(command.linkedBreedingId, 'event') ?? null, checkedAt: instant(command.occurredAt),
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', result: command.result, method: command.method ?? null,
        estimatedMonths: command.result === 'PREGNANT' ? command.estimatedMonths ?? null : null,
        ...await person(command.examiner, 'examinerId', 'examinerName'), note: command.note?.trim() || null,
      })
    } else {
      const episode = current.openPregnancy
      const episodeId = backendId(episode?.id, 'episode')
      if (!episode || episodeId === undefined) throw new Error('Không có thai kỳ đang mở để ghi diễn biến.')
      await transport.command(path(`/pregnancy-episodes/${episodeId}/updates`), {
        expectedEpisodeVersion: episode.version ?? null, type: command.updateType, occurredAt: instant(command.occurredAt),
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', details: command.details.trim() || null,
        healthCaseId: command.updateType === 'COMPLICATION' ? num(command.linkedHealthCaseId) ?? null : null,
      })
    }
  }

  async function calving(code: string, command: CalvingCommand): Promise<void> {
    const current = await known(code)
    const damId = await cattleId(code)
    const catalog = await catalogue()
    const episodeId = backendId(command.pregnancyId, 'episode')
    await transport.command(path('/calvings'), {
      damId, expectedCattleVersion: current.version, episodeId: episodeId ?? null,
      expectedEpisodeVersion: episodeId !== undefined ? current.openPregnancy?.version ?? null : null, noTrackedPregnancy: episodeId === undefined,
      birthAt: instant(command.birthAt), dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', ...await person(command.attendant, 'attendantId', 'attendantName'),
      course: command.course, damCondition: command.damCondition === 'MONITORING' ? 'NEEDS_MONITORING' : command.damCondition,
      retainedPlacenta: command.retainedPlacenta,
      calves: command.calves.map((calf) => {
        const live = calf.outcome === 'LIVE'
        return {
          outcome: calf.outcome, sex: calf.sex === 'UNKNOWN' ? (live ? null : 'UNKNOWN') : calf.sex,
          birthWeightKg: calf.weightKg ?? null, weightBasis: calf.weightKg != null ? calf.weightBasis ?? null : null,
          // Q5 / D36: thẻ tai không bắt buộc khi Đăng ký ngay; để trống thì backend cấp mã khi ghi sổ phiếu FARM_BORN.
          tagCode: live ? calf.earTag?.trim() || null : null, penId: live ? num(calf.penId) ?? null : null,
          breedId: live ? catalog.breedIds.get(calf.breed ?? '') ?? null : null, registration: live ? calf.registration ?? 'DRAFT' : null,
          purposeId: live && calf.registration === 'REGISTER_NOW' ? num(calf.productionPurpose) ?? null : null,
        }
      }),
    })
  }

  /** Chỉ gửi các trường đã đổi so với bản đã đọc (sửa đực giống khi bê đã đăng ký là MSG-FE11-07, kể cả khi gửi lại giá trị cũ). */
  async function correctEvent(code: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string): Promise<void> {
    const original = (await known(code)).events.find((event) => event.id === eventId)
    if (!original) throw new Error('Không tìm thấy bản ghi. Vui lòng tải lại trang.')
    const changed = <K extends keyof ReproductionEvent>(key: K) => patch[key] !== undefined && (patch[key] ?? null) !== (original[key] ?? null)
    const body: Record<string, unknown> = { expectedVersion: original.version, reason }
    if (changed('occurredAt')) body.occurredAt = instant(patch.occurredAt as string)
    if (changed('dataSource')) body.dataSource = patch.dataSource
    const updateId = backendId(eventId, 'update')
    if (updateId !== undefined) {
      if (changed('updateType')) body.type = patch.updateType
      if (changed('description')) body.details = patch.description
      if (changed('linkedHealthCaseId')) { if (patch.linkedHealthCaseId) body.healthCaseId = num(patch.linkedHealthCaseId); else body.unlinkHealthCase = true }
      await transport.command(path(`/pregnancy-updates/${updateId}/correction`), body)
      return
    }
    if (original.type === 'ESTRUS') {
      // Popup khởi tạo ô Mô tả bằng mô tả, hoặc dòng chi tiết khi chưa có mô tả.
      if (patch.description !== undefined && (patch.description ?? '') !== (original.description ?? original.details ?? '')) body.description = patch.description
      if (changed('observer')) Object.assign(body, await person(patch.observer, 'observerId', 'observerName'))
    } else if (original.type === 'BREEDING') {
      if (changed('method')) body.method = METHOD_OUT[patch.method as string] ?? patch.method
      if (changed('semenCode')) body.semenCode = patch.semenCode ?? ''
      if (changed('performer')) Object.assign(body, await person(patch.performer, 'performerId', 'performerName'))
      if (changed('linkedEstrusId')) { if (patch.linkedEstrusId) body.linkedEventId = backendId(patch.linkedEstrusId, 'event'); else body.unlinkEvent = true }
      if (changed('sireLabel')) {
        const label = (patch.sireLabel ?? '').trim()
        const sire = (await catalogue()).sires.find((item) => item.label === label || item.label.split(' · ').includes(label))
        if (sire) Object.assign(body, { sireSource: 'INTERNAL', sireCattleId: num(sire.id) })
        else { const id = await breedId(label); Object.assign(body, { sireSource: 'EXTERNAL', sireBreedId: id ?? null, sireBreed: id ? null : label }) }
      }
    } else if (original.type === 'PREGNANCY_CHECK') {
      if (changed('result')) body.result = patch.result
      if (changed('method')) body.method = patch.method
      if (changed('examiner')) Object.assign(body, await person(patch.examiner, 'examinerId', 'examinerName'))
      if (changed('linkedBreedingId')) { if (patch.linkedBreedingId) body.linkedEventId = backendId(patch.linkedBreedingId, 'event'); else body.unlinkEvent = true }
    }
    await transport.command(path(`/reproduction-events/${backendId(eventId, 'event')}/correction`), body)
  }

  async function correctCalving(code: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string): Promise<void> {
    const original = (await known(code)).calvings.find((item) => item.id === calvingId)
    if (!original) throw new Error('Không tìm thấy lần đẻ. Vui lòng tải lại trang.')
    if (patch.calves) {
      // Popup "Kết quả bê" gửi lại cả lần đẻ với một bê đã sửa.
      for (const calf of patch.calves) {
        const before = original.calves.find((item) => item.id === calf.id)
        if (!before) continue
        const body: Record<string, unknown> = { expectedVersion: before.version, reason }
        if (calf.sex !== before.sex) body.sex = calf.sex === 'UNKNOWN' ? '' : calf.sex
        if (calf.weightKg !== before.weightKg || calf.weightBasis !== before.weightBasis) {
          if (calf.weightKg == null) body.clearWeight = true
          else Object.assign(body, { birthWeightKg: calf.weightKg, weightBasis: calf.weightBasis })
        }
        if ((calf.earTag ?? '') !== (before.earTag ?? '')) body.tagCode = calf.earTag ?? ''
        if (Object.keys(body).length > 2) await transport.command(path(`/calf-outcomes/${backendId(calf.id, 'calf')}/correction`), body)
      }
      return
    }
    const body: Record<string, unknown> = { expectedVersion: original.version, reason }
    if (patch.birthAt !== undefined && patch.birthAt !== original.birthAt) body.birthAt = instant(patch.birthAt)
    if (patch.dataSource !== undefined && patch.dataSource !== original.dataSource) body.dataSource = patch.dataSource
    if (patch.attendant !== undefined && (patch.attendant ?? '') !== (original.attendant ?? '')) Object.assign(body, await person(patch.attendant, 'attendantId', 'attendantName'))
    if (patch.course !== undefined && patch.course !== original.course) body.course = patch.course
    if (patch.damCondition !== undefined && patch.damCondition !== original.damCondition) body.damCondition = patch.damCondition === 'MONITORING' ? 'NEEDS_MONITORING' : patch.damCondition
    if (patch.retainedPlacenta !== undefined && patch.retainedPlacenta !== original.retainedPlacenta) body.retainedPlacenta = patch.retainedPlacenta
    await transport.command(path(`/calvings/${backendId(calvingId, 'calving')}/correction`), body)
  }

  async function voidRecord(code: string, recordId: string, reason: string): Promise<void> {
    const current = await known(code)
    const event = current.events.find((item) => item.id === recordId)
    const calvingRecord = current.calvings.find((item) => item.id === recordId)
    const version = event?.version ?? calvingRecord?.version
    if (version === undefined) throw new Error('Không tìm thấy bản ghi. Vui lòng tải lại trang.')
    const target = recordId.startsWith('u-') ? `/pregnancy-updates/${backendId(recordId, 'update')}` : recordId.startsWith('c-')
      ? `/calvings/${backendId(recordId, 'calving')}` : `/reproduction-events/${backendId(recordId, 'event')}`
    await transport.command(path(`${target}/void`), { expectedVersion: version, reason })
  }

  return {
    async listWorklist(): Promise<ReproductionFemale[]> {
      return run(async () => {
        const rows = asRows(asRecord(await transport.get(path(`/reproduction-worklist${query({ tab: 'ALL' })}`))).items)
        return rows.map((row) => {
          const mapped = mapWorklistItem(row)
          const id = num(row.cattleId)
          if (id !== undefined && !cache.has(mapped.cattleCode)) cache.set(mapped.cattleCode, { cattleId: id })
          return mapped
        })
      })
    },
    getProfile: (code: string) => run(() => profile(code)),
    async formOptions(code: string): Promise<ReproductionFormOptions> {
      return run(async () => {
        const catalog = await catalogue()
        const cases = asRecord(await transport.get(path(`/health-cases/cattle/${await cattleId(code)}`)))
        const healthCases = [...asRows(cases.openCases), ...asRows(cases.previousCases)].map((c) => ({
          id: String(num(c.id) ?? ''), label: [textValue(c.caseCode), text(c.diagnosis) ?? text(c.openingSigns) ?? text(c.signs)].filter(Boolean).join(' · '),
        }))
        const { breedIds: _ids, memberIds: _members, ...visible } = catalog
        void _ids; void _members
        return { ...visible, healthCases }
      })
    },
    recordEvent: (code: string, command: ReproductionCommand) => run(async () => {
      // Kiểm tra trước khi gửi bằng đúng quy tắc của chế độ local (spec FE-11 / FE-12 mục 6), cùng cách báo lỗi.
      // Ca sức khỏe chỉ đi kèm Biến chứng (R-12-06); ô này ẩn với loại khác nên giá trị cũ được bỏ khi gửi, không báo lỗi.
      const checked = command.type === 'PREGNANCY_UPDATE' && command.updateType !== 'COMPLICATION' ? { ...command, linkedHealthCaseId: undefined } : command
      const errors = validateReproductionCommand(checked, { today: toFarmLocal(new Date().toISOString()), profile: await known(code) })
      if (errors.length) throw new Error(errors[0])
      await eventCommand(code, command)
      return profile(code)
    }),
    recordCalving: (code: string, command: CalvingCommand) => run(async () => { await calving(code, command); return profile(code) }),
    correctEvent: (code: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string) =>
      run(async () => { await correctEvent(code, eventId, patch, reason); return profile(code) }),
    voidEvent: (code: string, eventId: string, reason: string) => run(async () => { await voidRecord(code, eventId, reason); return profile(code) }),
    correctCalving: (code: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string) =>
      run(async () => { await correctCalving(code, calvingId, patch, reason); return profile(code) }),
    voidCalving: (code: string, calvingId: string, reason: string) => run(async () => { await voidRecord(code, calvingId, reason); return profile(code) }),
    voidCalf: (code: string, calvingId: string, calfId: string, reason: string) => run(async () => {
      const calf = (await known(code)).calvings.find((item) => item.id === calvingId)?.calves.find((item) => item.id === calfId)
      if (!calf) throw new Error('Không tìm thấy kết quả bê. Vui lòng tải lại trang.')
      await transport.command(path(`/calf-outcomes/${backendId(calfId, 'calf')}/void`), { expectedVersion: calf.version ?? null, reason })
      return profile(code)
    }),
  }
}

export type ReproductionBackend = ReturnType<typeof createReproductionBackend>
