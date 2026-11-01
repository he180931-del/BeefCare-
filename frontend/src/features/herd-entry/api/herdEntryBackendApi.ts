import type { CattleInput, DocumentRow, EntryCalf, EntryDetail, EntryDraft, EntryStatus, EntryType, HerdEntry, Payment, Pen } from '../../../types'
import {
  asRecord, asRows, enumPaymentMethod, isoDate, nullableNumber, numberValue, textValue, unwrapVoucher,
  type BackendTransport,
} from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'

export type { BackendTransport } from '../../../api/backendTransport'

type SaveInput = { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }
type PaymentInput = Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }

const statusFromBackend = (status: unknown): EntryStatus => status === 'POSTED' ? 'Đã nhập' : status === 'VOIDED' ? 'Đã hủy' : 'Nháp'
const typeFromBackend = (type: unknown): EntryType => type === 'FARM_BORN' ? 'Bê sinh tại trại' : 'Mua ngoài'
const entryType = (type: unknown) => type === 'Bê sinh tại trại' ? 'FARM_BORN' : 'PURCHASE'
const pricingBasis = (value: unknown) => value === 'con' || value === 'PER_HEAD' ? 'PER_HEAD' : 'PER_KG'
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
    type: typeFromBackend(row.entryType), date: textValue(row.entryDate), sourceId: row.sellerId == null && seller.id == null ? '' : String(row.sellerId ?? seller.id), pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg',
    quarantine: textValue(row.quarantineCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note), freight: numberValue(row.transportFee),
    paid: numberValue(row.amountPaid), method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', due: textValue(row.paymentDueDate),
    ...(farmBorn ? { calves: lines.map((line) => {
      const data = asRecord(line.data)
      return {
        name: textValue(data.name), tag: textValue(line.earTagNumber) || textValue(data.earTagNumber), mother: textValue(line.damCode) || textValue(data.damCode), father: 'Không rõ',
        born: textValue(data.birthDate ?? row.entryDate), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', weight: numberValue(line.entryWeightKg ?? data.entryWeightKg), estimated: (line.weightBasis ?? data.weightBasis) === 'ESTIMATED',
        purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), picked: true, barn: textValue(line.penCode),
        calfOutcomeId: nullableNumber(line.calfOutcomeId), damCode: textValue(line.damCode) || textValue(data.damCode), penId: nullableNumber(line.penId), purposeId: nullableNumber(data.purposeId),
      }
    }) } : { cows: lines.map((line) => {
      const data = asRecord(line.data)
      return {
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber), name: textValue(data.name),
        breed: textValue(data.breedName ?? line.breedName, data.breedId == null ? '' : `Giống #${numberValue(data.breedId)}`), breedId: nullableNumber(data.breedId), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', dob: textValue(data.birthDate),
        dobAccuracy: textValue(data.birthDateAccuracy, 'UNKNOWN'), stage: textValue(data.lifeStage, 'ADULT'), purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), purposeId: nullableNumber(data.purposeId), penId: nullableNumber(line.penId),
        weight: numberValue(line.entryWeightKg ?? data.entryWeightKg), estimated: (line.weightBasis ?? data.weightBasis) === 'ESTIMATED',
        barn: textValue(line.penCode), unitPrice: numberValue(line.unitPrice ?? data.unitPrice), hist: { vaccine: 'UNKNOWN', disease: 'UNKNOWN', repro: 'UNKNOWN' },
      }
    }) }),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: numberValue(row.version), date: textValue(row.entryDate),
    type: typeFromBackend(row.entryType), source: sellerName, count: numberValue(row.cattleCount, lines.length),
    weight: numberValue(row.totalWeightKg), total, debt: outstanding, status: statusFromBackend(row.status), detail, draft,
    cancelReason: textValue(row.voidReason), pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg', quarantine: textValue(row.quarantineCertNo),
  }
}

const findNamedId = (rows: unknown, name: string): number | null => {
  const normalize = (value: string) => value.split(' · ')[0].split(' – ')[0].trim().toLocaleLowerCase('vi')
  const wanted = normalize(name)
  const match = asRows(rows).find((row) => normalize(textValue(row.name ?? row.label ?? row.code)) === wanted)
  return match ? nullableNumber(match.id) : null
}

const mapPendingCalf = (calf: Record<string, unknown>): EntryCalf => ({
  name: 'Bê số 1', tag: textValue(calf.tagCode), mother: textValue(calf.damCode), father: textValue(calf.sireCode, 'Không rõ'),
  born: textValue(calf.birthDate), sex: calf.sex === 'MALE' ? 'Đực' : 'Cái', weight: numberValue(calf.birthWeightKg), estimated: false,
  purpose: 'Chưa xác định', picked: false, barn: textValue(calf.proposedPenCode), calfOutcomeId: numberValue(calf.calfOutcomeId),
  penId: nullableNumber(calf.proposedPenId), purposeId: nullableNumber(calf.defaultPurposeId),
  ...(calf.draftVoucherId == null ? {} : { draftVoucherId: numberValue(calf.draftVoucherId) }),
})

export function createHerdEntryBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number }) {
  const root = transport.farmPath(farmId, '/entry-vouchers')
  const list = async (): Promise<HerdEntry[]> => {
    const body = asRecord(await transport.get(root))
    return asRows(body.items).map(mapVoucher)
  }
  const listPens = async (): Promise<Pen[]> => asRows(asRecord(await transport.get(transport.farmPath(farmId, '/pens'))).pens).map((pen) => ({
    code: textValue(pen.code), name: textValue(pen.name, textValue(pen.code)), count: numberValue(pen.headcount), capacity: numberValue(pen.capacity),
    status: pen.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', cows: [], accept: textValue(pen.acceptsSummary),
  }))
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
      ...(farmBorn ? {} : { quarantineCertNo: textValue(draft.quarantine ?? detail.quarantine ?? record.quarantine) || null, vehiclePlate: textValue(draft.plate ?? detail.plate) || null, note: textValue(draft.note ?? detail.note) || null, pricingBasis: pricingBasis(draft.pricing ?? record.pricing), transportFee: numberValue(draft.freight ?? detail.freight), amountPaid: numberValue(draft.paid), paymentMethod: enumPaymentMethod(draft.method), paymentDueDate: textValue(draft.due) || null }),
      lines: lineRows.map((cow) => {
        const hist = asRecord(cow.hist)
        const barn = textValue(cow.barn)
        return {
          earTagNumber: textValue(cow.tag) || null, name: textValue(cow.name) || null, photoUrl: null, colourMarkings: null,
          breedId: nullableNumber(cow.breedId) ?? findNamedId(breedsBody, textValue(cow.breed)), sex: sex(cow.sex), birthDate: fullDate(cow.dob ?? cow.born),
          birthDateAccuracy: birthAccuracy(cow.dobAccuracy), ageMonths: nullableNumber(cow.ageMonths), lifeStage: lifeStage(cow.stage ?? cow.group, farmBorn),
          purposeId: findNamedId(purposesBody, textValue(cow.purpose)) ?? nullableNumber(cow.purposeId), entryWeightKg: numberValue(cow.weight),
          weightBasis: cow.estimated ? 'ESTIMATED' : 'MEASURED', penId: findNamedId(penRows.map((pen) => ({ ...pen, name: pen.code })), barn) ?? nullableNumber(cow.penId),
          unitPrice: numberValue(cow.unitPrice), quarantineUntil: textValue(cow.quarantineUntil) || null, warningReason: textValue(cow.warningReason) || null,
          vaccination: { status: declaration(hist.vaccine), informationSource: textValue(hist.vaccineNote) || null, items: [] },
          disease: { status: declaration(hist.disease), description: null },
          reproduction: { status: declaration(hist.repro), earlierCalvings: null, pregnantAtEntry: 'UNKNOWN', estMonthsPregnant: null, description: null },
          calfOutcomeId: nullableNumber(cow.calfOutcomeId), ...(farmBorn ? { damCode: textValue(cow.mother) } : {}),
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
  const sellers = async () => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=SELLER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone),
  }))
  return { list, listPens, get, save, discard, voidVoucher, recordPayment, pendingCalves, diedBeforeRegistration, sellers, downloadAttachment, removeAttachment, downloadImportTemplate, previewExcel, commitExcel }
}
