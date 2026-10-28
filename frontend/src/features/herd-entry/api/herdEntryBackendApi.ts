import type { CattleInput, EntryCalf, EntryDetail, EntryDraft, EntryStatus, EntryType, HerdEntry, Payment } from '../../../types'
import {
  asRecord, asRows, enumPaymentMethod, isoDate, nullableNumber, numberValue, textValue, unwrapVoucher,
  type BackendTransport,
} from '../../../api/backendTransport'

export type { BackendTransport } from '../../../api/backendTransport'

type SaveInput = { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[] }
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
const lifeStage = (value: unknown) => {
  const normalized = textValue(value).toLowerCase()
  if (normalized.includes('theo mẹ') || normalized.includes('sơ sinh')) return 'UNWEANED_CALF'
  if (normalized.includes('bê')) return 'WEANED_CALF'
  if (normalized.includes('tơ') || normalized.includes('young')) return 'YOUNG_STOCK'
  return 'ADULT'
}

const paymentRows = (value: unknown): Payment[] => asRows(value).map((row) => ({
  date: textValue(row.paymentDate ?? row.date),
  by: textValue(row.recordedBy ?? row.createdBy, '—'),
  method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
  ref: textValue(row.reference, '—'),
  amount: numberValue(row.amount),
}))

const mapVoucher = (value: unknown): HerdEntry => {
  const row = asRecord(value)
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
    payments: paymentRows(row.payments), docs: [],
    history: asRows(row.history).map((item) => textValue(item.message ?? item.text ?? item.kind)).filter(Boolean),
  }
  const draft: EntryDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.entryType), date: textValue(row.entryDate), sourceId: row.sellerId == null ? '' : String(row.sellerId), pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg',
    quarantine: textValue(row.quarantineCertNo), note: textValue(row.note), freight: numberValue(row.transportFee),
    paid: numberValue(row.amountPaid), method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', due: textValue(row.paymentDueDate),
    cows: lines.map((line) => {
      const data = asRecord(line.data)
      return {
        code: textValue(line.cattleCode), tag: textValue(line.earTagNumber ?? data.earTagNumber), name: textValue(data.name),
        breed: textValue(data.breedName ?? line.breedName, data.breedId == null ? '' : `Giống #${numberValue(data.breedId)}`), breedId: nullableNumber(data.breedId), sex: data.sex === 'MALE' ? 'Đực' : 'Cái', dob: textValue(data.birthDate),
        dobAccuracy: textValue(data.birthDateAccuracy, 'UNKNOWN'), stage: textValue(data.lifeStage, 'ADULT'), purpose: textValue(data.purposeName, data.purposeId == null ? '' : `Mục đích #${numberValue(data.purposeId)}`), purposeId: nullableNumber(data.purposeId), penId: nullableNumber(line.penId),
        weight: numberValue(line.entryWeightKg ?? data.entryWeightKg), estimated: (line.weightBasis ?? data.weightBasis) === 'ESTIMATED',
        barn: textValue(line.penCode), unitPrice: numberValue(line.unitPrice ?? data.unitPrice), hist: { vaccine: 'UNKNOWN', disease: 'UNKNOWN', repro: 'UNKNOWN' },
      }
    }),
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

export function createHerdEntryBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number }) {
  const root = transport.farmPath(farmId, '/entry-vouchers')
  const list = async (): Promise<HerdEntry[]> => {
    const body = asRecord(await transport.get(root))
    return asRows(body.items).map(mapVoucher)
  }
  const resolve = async (code: string): Promise<{ backendId: number; version: number }> => {
    const row = (await list()).find((item) => item.id === code)
    if (!row) throw new Error(`Không tìm thấy phiếu nhập ${code}`)
    return { backendId: numberValue(row.backendId), version: numberValue(row.version) }
  }
  const get = async (code: string): Promise<HerdEntry> => {
    const { backendId } = await resolve(code)
    return mapVoucher(await transport.get(`${root}/${backendId}`))
  }
  const save = async ({ id, record, cattleRows = [] }: SaveInput): Promise<HerdEntry> => {
    const draft = record.draft ?? {}
    const detail = record.detail ?? {}
    const existing = id ? await resolve(id).catch(() => null) : null
    const [pensBody, breedsBody, purposesBody, partnersBody] = await Promise.all([
      transport.get(transport.farmPath(farmId, '/pens')),
      transport.get(transport.farmPath(farmId, '/catalogues/breeds')),
      transport.get(transport.farmPath(farmId, '/catalogues/production-purposes')),
      transport.get(transport.farmPath(farmId, '/trading-partners?role=SELLER')),
    ])
    const penRows = asRows(asRecord(pensBody).pens ?? pensBody)
    const sourceName = textValue(detail.sourceName ?? record.source).split(' · ')[0]
    const sellerId = entryType(record.type) === 'PURCHASE' ? findNamedId(partnersBody, sourceName) : null
    const body = {
      entryType: entryType(record.type), entryDate: textValue(record.date ?? draft.date), sellerId,
      newSeller: entryType(record.type) === 'PURCHASE' && !sellerId ? { name: sourceName, phone: textValue(detail.phone), area: '' } : null,
      quarantineCertNo: textValue(draft.quarantine ?? detail.quarantine ?? record.quarantine) || null,
      vehiclePlate: textValue(detail.plate) || null, note: textValue(draft.note ?? detail.note) || null,
      pricingBasis: pricingBasis(draft.pricing ?? record.pricing), transportFee: numberValue(draft.freight ?? detail.freight),
      amountPaid: numberValue(draft.paid), paymentMethod: enumPaymentMethod(draft.method), paymentDueDate: textValue(draft.due) || null,
      lines: cattleRows.map((cow) => {
        const hist = asRecord(cow.hist)
        const barn = textValue(cow.barn)
        return {
          earTagNumber: textValue(cow.tag) || null, name: textValue(cow.name) || null, photoUrl: null, colourMarkings: null,
          breedId: nullableNumber(cow.breedId) ?? findNamedId(breedsBody, textValue(cow.breed)), sex: sex(cow.sex), birthDate: fullDate(cow.dob ?? cow.born),
          birthDateAccuracy: birthAccuracy(cow.dobAccuracy), ageMonths: nullableNumber(cow.ageMonths), lifeStage: lifeStage(cow.stage ?? cow.group),
          purposeId: nullableNumber(cow.purposeId) ?? findNamedId(purposesBody, textValue(cow.purpose)), entryWeightKg: numberValue(cow.weight),
          weightBasis: cow.estimated ? 'ESTIMATED' : 'MEASURED', penId: nullableNumber(cow.penId) ?? findNamedId(penRows.map((pen) => ({ ...pen, name: pen.code })), barn),
          unitPrice: numberValue(cow.unitPrice), quarantineUntil: textValue(cow.quarantineUntil) || null, warningReason: textValue(cow.warningReason) || null,
          vaccination: { status: declaration(hist.vaccine), informationSource: textValue(hist.vaccineNote) || null, items: [] },
          disease: { status: declaration(hist.disease), description: null },
          reproduction: { status: declaration(hist.repro), earlierCalvings: null, pregnantAtEntry: 'UNKNOWN', estMonthsPregnant: null, description: null },
          calfOutcomeId: nullableNumber(cow.calfOutcomeId),
        }
      }),
      expectedVersion: existing?.version ?? null,
    }
    const saved = unwrapVoucher(await transport.command(existing ? `${root}/${existing.backendId}` : root, body, existing ? { method: 'PUT' } : undefined))
    if (record.status !== 'Đã nhập') return mapVoucher(saved)
    const posted = await transport.command(`${root}/${numberValue(saved.id)}/post`, { expectedVersion: numberValue(saved.version), printQr: Boolean(draft.printQr) })
    return mapVoucher(unwrapVoucher(posted))
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
  const pendingCalves = async (): Promise<EntryCalf[]> => asRows(await transport.get(transport.farmPath(farmId, '/pending-calves'))).map((calf) => ({
    name: 'Bê số 1', tag: textValue(calf.tagCode), mother: textValue(calf.damCode), father: textValue(calf.sireCode, 'Không rõ'),
    born: textValue(calf.birthDate), sex: calf.sex === 'MALE' ? 'Đực' : 'Cái', weight: numberValue(calf.birthWeightKg), estimated: false,
    purpose: 'Chưa xác định', picked: true, barn: textValue(calf.proposedPenCode), calfOutcomeId: numberValue(calf.calfOutcomeId),
    penId: nullableNumber(calf.proposedPenId), purposeId: nullableNumber(calf.defaultPurposeId),
  }))
  const sellers = async () => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=SELLER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone),
  }))
  return { list, get, save, voidVoucher, recordPayment, pendingCalves, sellers }
}
