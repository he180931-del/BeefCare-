import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import type { EntryCalf, EntryDetail, EntryDocument, EntryDraft, EntryPayment, EntryStatus, EntryType, HerdEntry } from '../types'
import { toBusinessTime } from '../../../shared/lib/date/farmTime'
import { dmy } from '../../../shared/lib/format'
import { mapVoucherPayments } from '../../../shared/api/voucherPayments'

// Entry voucher DTO ↔ screen model mapping (EntryVoucherResource, PendingCalfResource), moved out of herdEntryBackendApi.ts.
export const statusFromBackend = (status: unknown): EntryStatus => status === 'POSTED' ? 'Đã nhập' : status === 'VOIDED' ? 'Đã hủy' : 'Nháp'
export const typeFromBackend = (type: unknown): EntryType => type === 'FARM_BORN' ? 'Bê sinh tại trại' : 'Mua ngoài'
export const entryType = (type: unknown) => type === 'Bê sinh tại trại' ? 'FARM_BORN' : 'PURCHASE'
export const pricingFromBackend = (value: unknown): 'kg' | 'con' => value === 'PER_HEAD' ? 'con' : 'kg'
export const sex = (value: unknown) => value === 'Đực' || value === 'MALE' ? 'MALE' : 'FEMALE'
export const declaration = (value: unknown) => value === 'Có' || value === 'KNOWN' ? 'KNOWN' : value === 'Không' || value === 'NONE' ? 'NONE' : 'UNKNOWN'
export const birthAccuracy = (value: unknown) => value === 'Chính xác' || value === 'EXACT' ? 'EXACT' : value === 'Ước tính' || value === 'ESTIMATED' ? 'ESTIMATED' : 'UNKNOWN'
export { fullDate } from '../domain/entryDate'
export const lifeStage = (value: unknown, farmBorn = false) => {
  const normalized = textValue(value).toLowerCase()
  if (['UNWEANED_CALF', 'WEANED_CALF', 'YOUNG_STOCK', 'ADULT'].includes(textValue(value))) return textValue(value)
  if (farmBorn && normalized.includes('bê')) return 'UNWEANED_CALF'
  if (normalized.includes('theo mẹ') || normalized.includes('sơ sinh')) return 'UNWEANED_CALF'
  if (normalized.includes('bê')) return 'WEANED_CALF'
  if (normalized.includes('tơ') || normalized.includes('young')) return 'YOUNG_STOCK'
  return 'ADULT'
}

export const paymentRows = (value: unknown): EntryPayment[] => mapVoucherPayments(value)

export const mapDocuments = (value: unknown, root: string, voucherId: number) => asRows(value).map((document) => ({
  id: numberValue(document.id),
  name: textValue(document.originalFilename, 'Tài liệu'),
  ext: textValue(document.contentType) === 'application/pdf' ? 'PDF' : 'JPG',
  size: numberValue(document.fileSize),
  url: `${root}/${voucherId}/attachments/${numberValue(document.id)}`,
}))

export const mergeDocuments = (...groups: Array<ReadonlyArray<EntryDocument> | undefined>): EntryDocument[] => {
  const seen = new Set<string>()
  const merged: EntryDocument[] = []
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

/** Current responses store declarations under data; legacy drafts may still expose them at line level. */
function mapEntryHistory(line: Record<string, unknown>) {
  const data = asRecord(line.data)
  const vaccination = asRecord(data.vaccination ?? line.vaccination)
  const vaccineItem = asRecord(asRows(vaccination.items)[0])
  const disease = asRecord(data.disease ?? line.disease)
  const reproduction = asRecord(data.reproduction ?? line.reproduction)
  const vaccineStatus = vaccination.status === 'KNOWN' ? 'Có' : vaccination.status === 'NONE' ? 'Không' : 'Không rõ'
  const vaccineItems = asRows(vaccination.items).map((item) => ({ vaccineId: nullableNumber(item.vaccineId) ?? undefined, vaccineName: textValue(item.vaccineName), vaccineDate: textValue(item.date), vaccineSource: textValue(item.informationSource) }))
  const diseaseStatus = disease.status === 'KNOWN' ? 'Có' : disease.status === 'NONE' ? 'Không' : 'Không rõ'
  const reproStatus = reproduction.status === 'KNOWN' ? 'Có' : reproduction.status === 'NONE' ? 'Không' : 'Không rõ'
  const pregnancyMonths = nullableNumber(reproduction.estMonthsPregnant)
  const earlierCalvings = nullableNumber(reproduction.earlierCalvings)
  return {
    vaccine: vaccineStatus, vaccineNote: textValue(vaccination.informationSource), vaccineDeclarationSource: textValue(vaccination.informationSource), vaccineId: nullableNumber(vaccineItem.vaccineId) ?? undefined,
    vaccineName: textValue(vaccineItem.vaccineName), vaccineDate: textValue(vaccineItem.date), vaccineSource: textValue(vaccineItem.informationSource), vaccineItems,
    disease: diseaseStatus, diseaseNote: textValue(disease.description), diseaseItems: textValue(disease.description).split('\n').map((item) => item.trim()).filter(Boolean), repro: reproStatus, pregnantAtEntry: textValue(reproduction.pregnantAtEntry),
    ...(earlierCalvings == null ? {} : { earlierCalvings }), ...(pregnancyMonths == null ? {} : { pregnancyMonths }),
    reproductionNote: textValue(reproduction.description),
  }
}

export const mapVoucher = (value: unknown, documents: unknown = [], breeds: unknown = []): HerdEntry => {
  const row = asRecord(value)
  const breedNames = new Map(asRows(breeds).map(breed => [nullableNumber(breed.id), textValue(breed.name)] as const))
  const seller = asRecord(row.seller)
  const lines = asRows(row.lines)
  const pricing = pricingFromBackend(row.pricingBasis)
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
        entryId: nullableNumber(line.id) ?? undefined,
        lineStatus: line.status === 'VALID' || line.status === 'VOID' ? line.status : undefined,
        lineVersion: nullableNumber(line.version) ?? undefined,
        cattleId: nullableNumber(line.cattleId) ?? undefined,
        weightBasis: line.weightBasis === 'MEASURED' || line.weightBasis === 'ESTIMATED' ? line.weightBasis : data.weightBasis === 'MEASURED' || data.weightBasis === 'ESTIMATED' ? data.weightBasis : undefined,
        breedId: nullableNumber(data.breedId ?? line.breedId) ?? undefined,
        sexCode: data.sex === 'MALE' || data.sex === 'FEMALE' ? data.sex : line.sex === 'MALE' || line.sex === 'FEMALE' ? line.sex : undefined,
        birthDate: textValue(data.birthDate) || undefined,
        birthDateAccuracy: data.birthDateAccuracy === 'EXACT' || data.birthDateAccuracy === 'ESTIMATED' || data.birthDateAccuracy === 'UNKNOWN' ? data.birthDateAccuracy : undefined,
        damCode: textValue(line.damCode ?? data.damCode), sireCode: textValue(line.sireCode ?? data.sireCode),
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber, '—'),
        name: textValue(data.name), breed: `${textValue(line.breedName ?? data.breedName) || breedNames.get(nullableNumber(data.breedId ?? line.breedId)) || 'Bò'} · ${line.sex === 'MALE' || data.sex === 'MALE' ? 'Đực' : 'Cái'}`,
        weight, barn: textValue(line.penCode), current: `${textValue(line.currentHerdStatus, statusFromBackend(row.status) === 'Đã nhập' ? 'ACTIVE' : 'DRAFT')} · ${textValue(line.currentPenCode ?? line.penCode)}`,
        amount: numberValue(line.lineAmount, weight * unitPrice), unitPrice, hist: mapEntryHistory(line),
      }
    }),
    cowsTotal: numberValue(row.cattleAmount), freight: numberValue(row.transportFee),
    payments: paymentRows(row.payments), docs: mapDocuments(documents, '', 0),
    history: asRows(row.history).map((item) => {
      if (item.kind !== 'ENTRY_LINE_CORRECT' && item.kind !== 'ENTRY_LINE_VOID') return textValue(item.message ?? item.text ?? item.kind)
      const details = asRecord(item.details)
      const at = toBusinessTime(item.at)
      const action = item.kind === 'ENTRY_LINE_CORRECT' ? 'Sửa bản ghi nhập' : 'Hủy bản ghi nhập'
      return [at ? `${dmy(at.slice(0, 10))} ${at.slice(11, 16)}` : '', textValue(item.actor), `${action} ${textValue(details.cattle)}`.trim(), textValue(details.reason)].filter(Boolean).join(' · ')
    }).filter(Boolean),
  }
  const farmBorn = row.entryType === 'FARM_BORN'
  const draft: EntryDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.entryType), date: textValue(row.entryDate), sourceId: row.sellerId == null && seller.id == null ? '' : String(row.sellerId ?? seller.id), pricing,
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
      const weight = numberValue(line.entryWeightKg ?? data.entryWeightKg)
      const basis = line.weightBasis ?? data.weightBasis
      return {
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber), name: textValue(data.name),
        // The voucher line response owns catalogue ids at line level. Older
        // drafts placed them under `data`; preserve both so reopening a row
        // does not turn a selected breed into a display-only label and then
        // submit a null breedId.
        breed: textValue(line.breedName ?? data.breedName) || breedNames.get(nullableNumber(line.breedId ?? data.breedId)) || ((line.breedId ?? data.breedId) == null ? '' : `Giống #${numberValue(line.breedId ?? data.breedId)}`), breedId: nullableNumber(line.breedId ?? data.breedId), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', dob: textValue(data.birthDate ?? line.birthDate),
        dobAccuracy: textValue(data.birthDateAccuracy ?? line.birthDateAccuracy, 'UNKNOWN'), stage: textValue(data.lifeStage, 'ADULT'), purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), purposeId: nullableNumber(data.purposeId), penId: nullableNumber(line.penId),
        weight, weightBasis: weight > 0 && (basis === 'MEASURED' || basis === 'ESTIMATED') ? basis : null, estimated: basis === 'ESTIMATED', pricing,
        barn: textValue(line.penCode), unitPrice: numberValue(line.unitPrice ?? data.unitPrice), hist: mapEntryHistory(line),
        quarantineUntil: textValue(line.quarantineUntil ?? data.quarantineUntil),
        colourMarkings: textValue(line.colourMarkings ?? data.colourMarkings),
        warningReason: textValue(line.warningReason ?? data.warningReason),
      }
    }) }),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: nullableNumber(row.version) ?? undefined, date: textValue(row.entryDate),
    sellerId: nullableNumber(row.sellerId ?? seller.id) ?? undefined,
    entryType: row.entryType === 'PURCHASE' || row.entryType === 'FARM_BORN' ? row.entryType : undefined,
    pricingBasis: row.pricingBasis === 'PER_KG' || row.pricingBasis === 'PER_HEAD' ? row.pricingBasis : undefined,
    type: typeFromBackend(row.entryType), source: sellerName, count: numberValue(row.cattleCount, lines.length),
    weight: numberValue(row.totalWeightKg), total, paid: nullableNumber(row.amountPaid) ?? undefined, debt: outstanding, status: statusFromBackend(row.status), detail, draft,
    cancelReason: textValue(row.voidReason), pricing, quarantine: textValue(row.quarantineCertNo),
  }
}

export const findNamedId = (rows: unknown, name: string): number | null => {
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
export const findPurposeId = (rows: unknown, name: string): number | null => {
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

export const mapPendingCalf = (calf: Record<string, unknown>): EntryCalf => {
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

// Moved from api/backendTransport.ts (refactor phase 2b): each voucher feature owns its payment/voucher envelope mapping.
export const enumPaymentMethod = (value: unknown): 'CASH' | 'BANK_TRANSFER' =>
  value === 'Tiền mặt' || value === 'CASH' ? 'CASH' : 'BANK_TRANSFER'

export const unwrapVoucher = (value: unknown): Record<string, unknown> => {
  const body = asRecord(value)
  return Object.hasOwn(body, 'voucher') ? asRecord(body.voucher) : body
}
