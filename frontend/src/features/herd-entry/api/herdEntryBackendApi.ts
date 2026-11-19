import type { CattleInput, DocumentRow, EntryCalf, EntryDetail, EntryDraft, EntryStatus, EntryType, HerdEntry, Payment, Pen } from '../../../types'
import {
  asRecord, asRows, enumPaymentMethod, isoDate, nullableNumber, numberValue, textValue, unwrapVoucher,
  type BackendTransport,
} from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'

export type { BackendTransport } from '../../../api/backendTransport'

type SaveInput = { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }
type PaymentInput = Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }

export type EntryListFilters = { type?: 'PURCHASE' | 'FARM_BORN'; from?: string; to?: string; sellerId?: number }
export type EntryListView = { rows: HerdEntry[]; tiles: Record<string, unknown>; counts: Record<string, number> }
export type EntryVaccineOption = { id: number; code: string; name: string; available: boolean }
export type EntryBreedOption = { id: number; code: string; name: string; available: boolean }
export type EntryParentOption = { id: number; code: string; sex: 'MALE' | 'FEMALE'; name: string }

const statusFromBackend = (status: unknown): EntryStatus => status === 'POSTED' ? 'Đã nhập' : status === 'VOIDED' ? 'Đã hủy' : 'Nháp'
const typeFromBackend = (type: unknown): EntryType => type === 'FARM_BORN' ? 'Bê sinh tại trại' : 'Mua ngoài'
const entryType = (type: unknown) => type === 'Bê sinh tại trại' ? 'FARM_BORN' : 'PURCHASE'
const sex = (value: unknown) => value === 'Đực' || value === 'MALE' ? 'MALE' : 'FEMALE'
const declaration = (value: unknown) => value === 'Có' || value === 'KNOWN' ? 'KNOWN' : value === 'Không' || value === 'NONE' ? 'NONE' : 'UNKNOWN'
const birthAccuracy = (value: unknown) => value === 'Chính xác' || value === 'EXACT' ? 'EXACT' : value === 'Ước tính' || value === 'ESTIMATED' ? 'ESTIMATED' : 'UNKNOWN'
const fullDate = (value: unknown) => {
  const date = textValue(value)
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date || null
}
const lifeStage = (value: unknown, farmBorn = false) => {
  const normalized = textValue(value).toLowerCase()
  if (farmBorn && normalized.includes('bê')) return 'UNWEANED_CALF'
  if (normalized.includes('theo mẹ') || normalized.includes('sơ sinh')) return 'UNWEANED_CALF'
  if (normalized.includes('bê')) return 'WEANED_CALF'
  if (normalized.includes('tơ') || normalized.includes('young')) return 'YOUNG_STOCK'
  return 'ADULT'
}

const canonical = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

const digest = (value: unknown): string => {
  const input = canonical(value)
  let first = 2166136261
  let second = 16777619
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 2166136261)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

const requestKey = (prefix: string, value: unknown): string => `${prefix}:${digest(value)}`

const digestBytes = async (bytes: Uint8Array): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const copied = new Uint8Array(bytes.byteLength)
    copied.set(bytes)
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', copied.buffer)
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return digest(bytes)
}

const readFileBytes = async (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Không thể đọc nội dung chứng từ'))
    reader.onerror = () => reject(reader.error ?? new Error('Không thể đọc nội dung chứng từ'))
    reader.readAsArrayBuffer(file)
  })
}

const fileDigest = async (file: File): Promise<string> => {
  const metadata = new TextEncoder().encode(`${file.name}\u0000${file.type}\u0000${file.size}\u0000${file.lastModified}\u0000`)
  const content = new Uint8Array(await readFileBytes(file))
  const bytes = new Uint8Array(metadata.length + content.length)
  bytes.set(metadata)
  bytes.set(content, metadata.length)
  return digestBytes(bytes)
}

const paymentRows = (value: unknown): Payment[] => asRows(value).map((row) => ({
  date: textValue(row.paymentDate ?? row.date),
  by: textValue(row.recordedBy ?? row.createdBy, '—'),
  method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
  ref: textValue(row.reference, '—'),
  amount: numberValue(row.amount),
}))

const mapDocuments = (value: unknown, root: string, voucherId: number) => asRows(value).map((document) => ({
  id: numberValue(document.id),
  name: textValue(document.originalFilename, 'Tài liệu'),
  ext: textValue(document.contentType) === 'application/pdf' ? 'PDF' : 'JPG',
  size: numberValue(document.fileSize),
  url: `${root}/${voucherId}/attachments/${numberValue(document.id)}`,
}))

const mergeDocuments = (...groups: Array<ReadonlyArray<DocumentRow> | undefined>): DocumentRow[] => {
  const seen = new Set<string>()
  const merged: DocumentRow[] = []
  for (const group of groups) {
    for (const document of group ?? []) {
      const key = document.id == null ? `${document.name}\u0000${String(document.size ?? '')}` : `id:${String(document.id)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(document)
    }
  }
  return merged
}

const mapVoucher = (value: unknown, documents: unknown = []): HerdEntry => {
  const row = asRecord(value)
  const seller = asRecord(row.seller)
  const lines = asRows(row.lines)
  const sellerName = textValue(row.sellerName ?? asRecord(row.seller).name)
  const total = nullableNumber(row.totalPayable ?? row.totalAmount)
  const outstanding = nullableNumber(row.outstanding ?? row.outstandingAmount)
  const detail: EntryDetail = {
    sourceName: sellerName,
    quarantine: textValue(row.quarantineCertNo),
    phone: textValue(row.sellerPhone ?? asRecord(row.seller).phone),
    plate: textValue(row.vehiclePlate),
    by: textValue(row.postedBy ?? row.createdBy, '—'),
    note: textValue(row.note),
    cows: lines.map((line) => {
      const data = asRecord(line.data)
      const weight = numberValue(line.entryWeightKg ?? data.entryWeightKg)
      const unitPrice = numberValue(line.unitPrice ?? data.unitPrice)
      return {
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber, '—'),
        name: textValue(data.name), breed: `${textValue(line.breedName ?? data.breedName, 'Bò')} · ${line.sex === 'MALE' || data.sex === 'MALE' ? 'Đực' : 'Cái'}`,
        weight, barn: textValue(line.penCode), current: `${textValue(line.currentHerdStatus, statusFromBackend(row.status) === 'Đã nhập' ? 'ACTIVE' : 'DRAFT')} · ${textValue(line.currentPenCode ?? line.penCode)}`,
        amount: numberValue(line.lineAmount, weight * unitPrice), unitPrice,
      }
    }),
    cowsTotal: numberValue(row.cattleAmount), freight: numberValue(row.transportFee),
    payments: paymentRows(row.payments), docs: mapDocuments(documents, '', 0),
    history: asRows(row.history).map((item) => textValue(item.message ?? item.text ?? item.kind)).filter(Boolean),
  }
  const farmBorn = row.entryType === 'FARM_BORN'
  const draft: EntryDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.entryType), date: textValue(row.entryDate), sourceId: row.sellerId == null && seller.id == null ? '' : String(row.sellerId ?? seller.id), pricing: 'kg',
    quarantine: textValue(row.quarantineCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note), freight: numberValue(row.transportFee),
    paid: numberValue(row.amountPaid), method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', due: textValue(row.paymentDueDate),
    ...(farmBorn ? { calves: lines.map((line) => {
      const data = asRecord(line.data)
      return {
        name: textValue(data.name), tag: textValue(line.earTagNumber) || textValue(data.earTagNumber), mother: textValue(line.damCode) || textValue(data.damCode), father: textValue(line.sireCode, 'Không rõ'),
        born: textValue(data.birthDate ?? row.entryDate), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', weight: numberValue(line.entryWeightKg ?? data.entryWeightKg), estimated: (line.weightBasis ?? data.weightBasis) === 'ESTIMATED',
        purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), picked: true, barn: textValue(line.penCode),
        calfOutcomeId: nullableNumber(line.calfOutcomeId), damId: nullableNumber(line.damId) ?? undefined, sireId: nullableNumber(line.sireId) ?? undefined, damCode: textValue(line.damCode) || textValue(data.damCode), penId: nullableNumber(line.penId), purposeId: nullableNumber(data.purposeId),
      }
    }) } : { cows: lines.map((line) => {
      const data = asRecord(line.data)
      return {
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber), name: textValue(data.name),
        // The voucher line response owns catalogue ids at line level. Older
        // drafts placed them under `data`; preserve both so reopening a row
        // does not turn a selected breed into a display-only label and then
        // submit a null breedId.
        breed: textValue(line.breedName ?? data.breedName, (line.breedId ?? data.breedId) == null ? '' : `Giống #${numberValue(line.breedId ?? data.breedId)}`), breedId: nullableNumber(line.breedId ?? data.breedId), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', dob: textValue(data.birthDate),
        dobAccuracy: textValue(data.birthDateAccuracy, 'UNKNOWN'), stage: textValue(data.lifeStage, 'ADULT'), purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), purposeId: nullableNumber(data.purposeId), penId: nullableNumber(line.penId),
        weight: numberValue(line.entryWeightKg ?? data.entryWeightKg), estimated: (line.weightBasis ?? data.weightBasis) === 'ESTIMATED',
        barn: textValue(line.penCode), unitPrice: numberValue(line.unitPrice ?? data.unitPrice), hist: (() => {
          const vaccination = asRecord(line.vaccination)
          const vaccineItem = asRecord(asRows(vaccination.items)[0])
          const disease = asRecord(line.disease)
          const reproduction = asRecord(line.reproduction)
          const vaccineStatus = vaccination.status === 'KNOWN' ? 'Có' : vaccination.status === 'NONE' ? 'Không' : 'Không rõ'
          const vaccineItems = asRows(vaccination.items).map((item) => ({ vaccineId: nullableNumber(item.vaccineId) ?? undefined, vaccineName: textValue(item.vaccineName), vaccineDate: textValue(item.date), vaccineSource: textValue(item.informationSource) }))
          const diseaseStatus = disease.status === 'KNOWN' ? 'Có' : disease.status === 'NONE' ? 'Không' : 'Không rõ'
          const reproStatus = reproduction.status === 'KNOWN' ? 'Có' : reproduction.status === 'NONE' ? 'Không' : 'Không rõ'
          const pregnancyMonths = nullableNumber(reproduction.estMonthsPregnant)
          const earlierCalvings = nullableNumber(reproduction.earlierCalvings)
          return {
            vaccine: vaccineStatus, vaccineNote: textValue(vaccination.informationSource), vaccineId: nullableNumber(vaccineItem.vaccineId) ?? undefined,
            vaccineName: textValue(vaccineItem.vaccineName), vaccineDate: textValue(vaccineItem.date), vaccineSource: textValue(vaccineItem.informationSource), vaccineItems,
            disease: diseaseStatus, diseaseNote: textValue(disease.description), diseaseItems: textValue(disease.description).split('\n').map((item) => item.trim()).filter(Boolean), repro: reproStatus, pregnantAtEntry: textValue(reproduction.pregnantAtEntry),
            ...(earlierCalvings == null ? {} : { earlierCalvings }), ...(pregnancyMonths == null ? {} : { pregnancyMonths }),
            reproductionNote: textValue(reproduction.description),
          }
        })(),
      }
    }) }),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: numberValue(row.version), date: textValue(row.entryDate),
    type: typeFromBackend(row.entryType), source: sellerName, count: numberValue(row.cattleCount, lines.length),
    weight: numberValue(row.totalWeightKg), total, debt: outstanding, status: statusFromBackend(row.status), detail, draft,
    cancelReason: textValue(row.voidReason), pricing: 'kg', quarantine: textValue(row.quarantineCertNo),
  }
}

const findNamedId = (rows: unknown, name: string): number | null => {
  const normalize = (value: string) => value.split(' · ')[0].split(' – ')[0].trim().toLocaleLowerCase('vi')
  const wanted = normalize(name)
  const match = asRows(rows).find((row) => normalize(textValue(row.name ?? row.label ?? row.code)) === wanted)
  return match ? nullableNumber(match.id) : null
}

/**
 * The entry editor uses product-facing labels (for example
 * "Bò sinh sản · loại Sinh sản"), while the catalogue API returns the
 * canonical purpose name ("Bò cái sinh sản") and its purposeType.  Matching
 * only the display name silently produced purposeId=null, so the backend then
 * reported the misleading generic required-field error. Prefer the canonical
 * type and retain a name alias fallback for older catalogue responses.
 */
const findPurposeId = (rows: unknown, name: string): number | null => {
  const wanted = textValue(name).trim().toLocaleLowerCase('vi')
  const exact = findNamedId(rows, name)
  if (exact != null) return exact
  const purposeType = wanted.includes('sinh sản') || wanted.includes('sinh san')
    ? 'BREEDING'
    : wanted.includes('vỗ béo') || wanted.includes('vo beo') || wanted.includes('thương phẩm') || wanted.includes('thuong pham')
      ? 'FATTENING'
      : wanted.includes('đực giống') || wanted.includes('duc giong') || wanted.includes('giữ giống') || wanted.includes('giu giong')
        ? 'SIRE'
        : wanted === 'chưa xác định' || wanted === 'chua xac dinh'
          ? 'UNDECIDED'
          : null
  if (!purposeType) return null
  const match = asRows(rows).find((row) => textValue(row.purposeType).toUpperCase() === purposeType)
  if (match) return nullableNumber(match.id)
  const aliases: Record<string, string[]> = {
    BREEDING: ['bò cái sinh sản', 'bò sinh sản', 'sinh sản'],
    FATTENING: ['vỗ béo', 'nuôi thương phẩm', 'nuôi thịt'],
    SIRE: ['đực giống', 'giữ giống'],
    UNDECIDED: ['chưa xác định'],
  }
  const aliasMatch = asRows(rows).find((row) => aliases[purposeType].some((alias) => textValue(row.name ?? row.label ?? row.code).toLocaleLowerCase('vi').includes(alias)))
  return aliasMatch ? nullableNumber(aliasMatch.id) : null
}

const mapPendingCalf = (calf: Record<string, unknown>): EntryCalf => {
  const damId = nullableNumber(calf.damId)
  const sireId = nullableNumber(calf.sireId)
  const draftVoucherId = nullableNumber(calf.draftVoucherId)
  return {
    name: 'Bê số 1', tag: textValue(calf.tagCode), mother: textValue(calf.damCode), father: textValue(calf.sireCode, 'Không rõ'),
    ...(damId == null ? {} : { damId }),
    ...(sireId == null ? {} : { sireId }),
    ...(textValue(calf.sireSource) ? { sireSource: textValue(calf.sireSource) } : {}),
    ...(textValue(calf.externalSireName) ? { externalSireName: textValue(calf.externalSireName) } : {}),
    ...(textValue(calf.semenBatch) ? { semenBatch: textValue(calf.semenBatch) } : {}),
    ...(textValue(calf.sireBreedCode) ? { sireBreed: textValue(calf.sireBreedCode) } : {}),
    born: textValue(calf.birthDate), sex: calf.sex === 'MALE' ? 'Đực' : 'Cái', weight: numberValue(calf.birthWeightKg), estimated: false,
    purpose: 'Chưa xác định', picked: false, barn: textValue(calf.proposedPenCode), calfOutcomeId: numberValue(calf.calfOutcomeId),
    penId: nullableNumber(calf.proposedPenId), purposeId: nullableNumber(calf.defaultPurposeId),
    ...(draftVoucherId == null ? {} : { draftVoucherId }),
  }
}

export function createHerdEntryBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number }) {
  const root = transport.farmPath(farmId, '/entry-vouchers')
  const listView = async (filters: EntryListFilters = {}): Promise<EntryListView> => {
    const params = new URLSearchParams()
    if (filters.type) params.set('type', filters.type)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.sellerId != null) params.set('sellerId', String(filters.sellerId))
    const body = asRecord(await transport.get(params.size ? `${root}?${params.toString()}` : root))
    return {
      rows: asRows(body.items).map(mapVoucher),
      tiles: asRecord(body.tiles),
      counts: Object.fromEntries(Object.entries(asRecord(body.statusCounts)).flatMap(([key, value]) => typeof value === 'number' ? [[key, value]] : [])),
    }
  }
  const list = async (): Promise<HerdEntry[]> => (await listView()).rows
  const listPens = async (): Promise<Pen[]> => {
    const response = await transport.get(transport.farmPath(farmId, '/pens'))
    const body = asRecord(response)
    // PenResource returns PenListDTO `{ pens: [...] }`; accepting a bare array
    // here also keeps the adapter tolerant of the older local proxy response.
    const rows = Array.isArray(response) ? asRows(response) : asRows(body.pens)
    return rows.map((pen) => {
      const envelope = asRecord(pen.currentCriteria)
      const criteria = asRecord(envelope.criteria ?? envelope)
      const list = (value: unknown) => Array.isArray(value) ? value.map((item) => textValue(item)).filter(Boolean) : undefined
      return {
        id: numberValue(pen.id), code: textValue(pen.code), name: textValue(pen.name, textValue(pen.code)), count: numberValue(pen.headcount), capacity: numberValue(pen.capacity),
        status: pen.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', cows: [], accept: textValue(pen.acceptsSummary),
        receptionCriteria: {
          purposeTypes: list(criteria.purposeTypes),
          lifeStages: list(criteria.lifeStages),
          sex: textValue(criteria.sex) || undefined,
          minAgeMonths: criteria.minAgeMonths == null ? null : numberValue(criteria.minAgeMonths),
          minWeightKg: criteria.minWeightKg == null ? null : numberValue(criteria.minWeightKg),
        },
      }
    })
  }
  const resolve = async (code: string): Promise<{ backendId: number; version: number }> => {
    const row = (await list()).find((item) => item.id === code)
    if (!row) throw new BackendError(404, { message: `Không tìm thấy phiếu nhập ${code}` })
    return { backendId: numberValue(row.backendId), version: numberValue(row.version) }
  }
  const discard = async (code: string): Promise<void> => {
    const current = await resolve(code)
    await transport.command(`${root}/${current.backendId}`, undefined, {
      method: 'DELETE', key: requestKey('entry-discard', { voucherId: current.backendId, version: current.version }),
    })
  }
  const get = async (code: string): Promise<HerdEntry> => {
    const { backendId } = await resolve(code)
    const [voucherBody, documentBody] = await Promise.all([
      transport.get(`${root}/${backendId}`),
      transport.get(`${root}/${backendId}/attachments`),
    ])
    const result = mapVoucher(voucherBody)
    result.detail = {
      ...result.detail,
      docs: mapDocuments(documentBody, root, backendId),
    }
    return result
  }
  const downloadAttachment = async (code: string, attachmentId: number): Promise<Blob> => {
    const { backendId } = await resolve(code)
    const result = await transport.get(`${root}/${backendId}/attachments/${attachmentId}`)
    if (!(result instanceof Blob)) throw new Error('Backend không trả về nội dung chứng từ hợp lệ')
    return result
  }
  const removeAttachment = async (code: string, attachmentId: number): Promise<void> => {
    const { backendId } = await resolve(code)
    await transport.command(`${root}/${backendId}/attachments/${attachmentId}`, undefined, { method: 'DELETE' })
  }
  const downloadImportTemplate = async (): Promise<Blob> => {
    const result = await transport.get(`${root}/import-template`)
    if (!(result instanceof Blob)) throw new Error('Backend không trả về file mẫu Excel hợp lệ')
    return result
  }
  const importExcel = async (code: string, file: File, commit: boolean): Promise<unknown> => {
    const { backendId } = await resolve(code)
    const form = new FormData()
    form.append('file', file)
    return transport.command(`${root}/${backendId}/import?commit=${commit ? 'true' : 'false'}`, form)
  }
  const previewExcel = (code: string, file: File) => importExcel(code, file, false)
  const commitExcel = (code: string, file: File) => importExcel(code, file, true)
  const save = async ({ id, record, cattleRows, documents = [] }: SaveInput): Promise<HerdEntry> => {
    const existing = id ? await resolve(id).catch((error: unknown) => {
      if (error instanceof BackendError && error.status === 404) return null
      throw error
    }) : null
    let current: HerdEntry | null = null
    if (existing && !record.type) {
      current = await get(id!)
      record = {
        ...current,
        ...record,
        detail: { ...current.detail, ...record.detail },
        draft: record.draft ?? current.draft,
      }
    }
    const draft = record.draft ?? {}
    const detail = record.detail ?? {}
    const lineRows = cattleRows ?? (current?.draft?.calves ?? current?.draft?.cows ?? [])
    const persistedDocuments = existing
      ? mapDocuments(await transport.get(`${root}/${existing.backendId}/attachments`), root, existing.backendId)
      : []
    const [pensBody, breedsBody, purposesBody, partnersBody] = await Promise.all([
      transport.get(transport.farmPath(farmId, '/pens')),
      transport.get(transport.farmPath(farmId, '/catalogues/breeds')),
      transport.get(transport.farmPath(farmId, '/catalogues/production-purposes')),
      transport.get(transport.farmPath(farmId, '/trading-partners?role=SELLER')),
    ])
    const penRows = asRows(asRecord(pensBody).pens ?? pensBody)
    const sourceName = textValue(detail.sourceName ?? record.source).split(' · ')[0]
    const sellerId = entryType(record.type) === 'PURCHASE' ? findNamedId(partnersBody, sourceName) : null
    const farmBorn = entryType(record.type) === 'FARM_BORN'
    const body = {
      entryType: entryType(record.type), entryDate: textValue(record.date ?? draft.date), sellerId: farmBorn ? null : sellerId,
      ...(farmBorn ? {} : { newSeller: !sellerId ? { name: sourceName, phone: textValue(detail.phone), area: '' } : null }),
      // Pricing is owned by each entry line in the UI. The backend contract
      // still requires the voucher basis, so keep the compatibility default
      // explicitly fixed to PER_KG and never read a removed global selector.
      ...(farmBorn ? {} : { quarantineCertNo: textValue(draft.quarantine ?? detail.quarantine ?? record.quarantine) || null, vehiclePlate: textValue(draft.plate ?? detail.plate) || null, note: textValue(draft.note ?? detail.note) || null, pricingBasis: lineRows.length > 0 && lineRows.every((cow) => cow.pricing === 'con') ? 'PER_HEAD' : 'PER_KG', transportFee: numberValue(draft.freight ?? detail.freight), amountPaid: numberValue(draft.paid), paymentMethod: enumPaymentMethod(draft.method), paymentDueDate: textValue(draft.due) || null }),
      lines: lineRows.map((cow) => {
        const hist = asRecord(cow.hist)
        const vaccineItems = Array.isArray(hist.vaccineItems) ? hist.vaccineItems.map(asRecord) : []
        const diseaseItems = Array.isArray(hist.diseaseItems) ? hist.diseaseItems.map((item) => textValue(item).trim()).filter(Boolean) : []
        const barn = textValue(cow.barn)
        const basis = cow.weightBasis ?? (numberValue(cow.weight) > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null)
        return {
          earTagNumber: textValue(cow.tag) || null, name: textValue(cow.name) || null, photoUrl: null, colourMarkings: textValue(cow.colourMarkings) || null,
          breedId: nullableNumber(cow.breedId) ?? findNamedId(breedsBody, textValue(cow.breed)), sex: sex(cow.sex), birthDate: fullDate(cow.dob ?? cow.born),
          birthDateAccuracy: birthAccuracy(cow.dobAccuracy), ageMonths: nullableNumber(cow.ageMonths), lifeStage: lifeStage(cow.stage ?? cow.group, farmBorn),
          purposeId: findPurposeId(purposesBody, textValue(cow.purpose)) ?? nullableNumber(cow.purposeId), entryWeightKg: cow.pricing === 'con' ? null : basis ? numberValue(cow.weight) : null,
          weightBasis: cow.pricing === 'con' ? null : basis, penId: findNamedId(penRows.map((pen) => ({ ...pen, name: pen.code })), barn) ?? nullableNumber(cow.penId),
          unitPrice: numberValue(cow.unitPrice), quarantineUntil: textValue(cow.quarantineUntil) || null, warningReason: textValue(cow.warningReason) || null,
          vaccination: {
            status: declaration(hist.vaccine),
            informationSource: textValue(hist.vaccineSource ?? hist.vaccineNote) || null,
            items: (vaccineItems.length ? vaccineItems : (hist.vaccineId != null || textValue(hist.vaccineName) || textValue(hist.vaccineDate) || textValue(hist.vaccineSource)) ? [{ vaccineId: nullableNumber(hist.vaccineId), vaccineName: textValue(hist.vaccineName) || null, date: textValue(hist.vaccineDate) || null, informationSource: textValue(hist.vaccineSource) || null }] : []).map((item) => ({ vaccineId: nullableNumber(item.vaccineId), vaccineName: textValue(item.vaccineName) || null, date: textValue(item.date ?? item.vaccineDate) || null, informationSource: textValue(item.informationSource ?? item.vaccineSource) || null })),
          },
          disease: { status: declaration(hist.disease), description: (diseaseItems.length ? diseaseItems : [textValue(hist.diseaseNote)]).filter(Boolean).join('\n') || null },
          reproduction: { status: declaration(hist.repro), earlierCalvings: nullableNumber(hist.earlierCalvings), pregnantAtEntry: textValue(hist.pregnantAtEntry) || 'UNKNOWN', estMonthsPregnant: textValue(hist.pregnantAtEntry) === 'YES' ? nullableNumber(hist.pregnancyMonths) : null, description: textValue(hist.reproductionNote) || null },
          // Parentage is persisted by cattle IDs; display codes are derived by
          // the backend and must not be sent as an unsupported DTO field.
          calfOutcomeId: nullableNumber(cow.calfOutcomeId), ...(farmBorn ? { damId: nullableNumber(cow.damId), sireId: nullableNumber(cow.sireId), externalSireCode: textValue(cow.externalSireCode) || null } : {}),
        }
      }),
      expectedVersion: existing?.version ?? null,
    }
    const operationKey = requestKey('entry-save', { id: id ?? null, body })
    const saved = unwrapVoucher(await transport.command(existing ? `${root}/${existing.backendId}` : root, body, { ...(existing ? { method: 'PUT' } : {}), key: operationKey }))
    const voucherId = numberValue(saved.id)
    const uploadedDocuments = []
    for (const document of documents) {
      const form = new FormData()
      form.append('file', document)
      uploadedDocuments.push(await transport.command(`${root}/${voucherId}/attachments`, form, { key: requestKey('entry-attachment', { voucherId, file: await fileDigest(document) }) }))
    }
    if (record.status !== 'Đã nhập') {
      const result = mapVoucher(saved)
      result.detail = { ...result.detail, docs: mergeDocuments(persistedDocuments, detail.docs, mapDocuments(uploadedDocuments, root, voucherId)) }
      return result
    }
    const postBody = { expectedVersion: numberValue(saved.version), printQr: Boolean(draft.printQr ?? record.printQr) }
    const posted = await transport.command(`${root}/${voucherId}/post`, postBody, { key: requestKey('entry-post', { voucherId, body: postBody }) })
    const result = mapVoucher(unwrapVoucher(posted))
    result.detail = { ...result.detail, docs: mergeDocuments(persistedDocuments, detail.docs, mapDocuments(uploadedDocuments, root, voucherId)) }
    return result
  }
  const voidVoucher = async (code: string, reason: string): Promise<HerdEntry> => {
    const current = await resolve(code)
    const result = await transport.command(`${root}/${current.backendId}/void`, { reason, expectedVersion: current.version })
    return mapVoucher(unwrapVoucher(result))
  }
  const recordPayment = async (code: string, payment: PaymentInput): Promise<HerdEntry> => {
    const current = await resolve(code)
    await transport.command(transport.farmPath(farmId, `/vouchers/entry/${current.backendId}/payments`), {
      paymentDate: isoDate(payment.date), amount: payment.amount, method: enumPaymentMethod(payment.method), reference: payment.ref || null,
      note: payment.note || null, voucherVersion: current.version,
    })
    return get(code)
  }
  const pendingCalves = async (): Promise<EntryCalf[]> => asRows(await transport.get(transport.farmPath(farmId, '/pending-calves'))).map(mapPendingCalf)
  const diedBeforeRegistration = async (calfOutcomeId: number, reason: string): Promise<EntryCalf> => {
    const result = await transport.command(
      transport.farmPath(farmId, `/pending-calves/${calfOutcomeId}/died-before-registration`),
      { reason },
      { key: requestKey('pending-calf-died', { calfOutcomeId, reason }) },
    )
    return mapPendingCalf(asRecord(result))
  }
  const assignCalfParentage = async (calfOutcomeId: number, parentage: { damId: number; sireId?: number; sireSource: 'NONE' | 'INTERNAL' | 'AI'; externalSireCode?: string }): Promise<EntryCalf> => {
    const result = await transport.command(transport.farmPath(farmId, `/pending-calves/${calfOutcomeId}/parentage`), parentage, {
      key: requestKey('pending-calf-parentage', { calfOutcomeId, parentage }),
    })
    return mapPendingCalf(asRecord(result))
  }
  const sellers = async () => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=SELLER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone),
  }))
  const vaccines = async (): Promise<EntryVaccineOption[]> => asRows(asRecord(await transport.get(transport.farmPath(farmId, '/catalogues'))).vaccines).map((row) => ({
    id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name, textValue(row.code)), available: row.available !== false,
  })).filter((row) => row.id > 0 && row.available)
  const breeds = async (): Promise<EntryBreedOption[]> => asRows(await transport.get(transport.farmPath(farmId, '/catalogues/breeds'))).map((row) => ({
    id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name, textValue(row.code)), available: row.available !== false,
  })).filter((row) => row.id > 0 && row.available)
  const parentCattle = async (): Promise<EntryParentOption[]> => {
    const body = asRecord(await transport.get(transport.farmPath(farmId, '/cattle?herdStatus=ACTIVE&size=200')))
    return asRows(body.items).map((row): EntryParentOption => ({ id: numberValue(row.id), code: textValue(row.code ?? row.displayCode), sex: row.sex === 'MALE' ? 'MALE' : 'FEMALE', name: textValue(row.name) })).filter((row) => row.id > 0)
  }
  return { list, listView, listPens, get, save, discard, voidVoucher, recordPayment, pendingCalves, diedBeforeRegistration, assignCalfParentage, sellers, vaccines, breeds, parentCattle, downloadAttachment, removeAttachment, downloadImportTemplate, previewExcel, commitExcel }
}
