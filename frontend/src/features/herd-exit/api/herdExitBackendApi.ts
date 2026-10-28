import type { CattleInput, ExitDetail, ExitDraft, ExitStatus, ExitType, HerdExit, Payment } from '../../../types'
import {
  asRecord, asRows, enumPaymentMethod, isoDate, nullableNumber, numberValue, textValue, unwrapVoucher,
  type BackendTransport,
} from '../../../api/backendTransport'

export type { BackendTransport } from '../../../api/backendTransport'

type SaveInput = { id?: string; record: Partial<HerdExit>; cattleRows?: CattleInput[] }
type PaymentInput = Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }
export type ExitCandidate = {
  code: string; tag: string; breed: string; sex: string; age: string; group: string; stage: string; barn: string
  weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string
}

const statusFromBackend = (status: unknown): ExitStatus => {
  if (status === 'CONFIRMED') return 'Đã xuất'
  if (status === 'VOIDED') return 'Đã hủy'
  if (status === 'DISMISSED') return 'Đã bác'
  if (status === 'PENDING') return 'Chờ xác nhận'
  return 'Nháp'
}
const typeFromBackend = (type: unknown): ExitType => type === 'DEATH' ? 'Chết / mất' : type === 'CULL' ? 'Loại thải' : type === 'OTHER' ? 'Khác' : 'Bán'
const exitType = (type: unknown) => type === 'Chết / mất' ? 'DEATH' : type === 'Loại thải' ? 'CULL' : type === 'Khác' ? 'OTHER' : 'SALE'
const pricingBasis = (value: unknown) => value === 'con' || value === 'PER_HEAD' ? 'PER_HEAD' : 'PER_KG'

const paymentRows = (value: unknown): Payment[] => asRows(value).map((row) => ({
  date: textValue(row.paymentDate ?? row.date), by: textValue(row.recordedBy ?? row.createdBy, '—'),
  method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', ref: textValue(row.reference, '—'), amount: numberValue(row.amount),
}))

const mapVoucher = (value: unknown): HerdExit => {
  const row = asRecord(value)
  const lines = asRows(row.lines)
  const buyer = asRecord(row.buyer)
  const buyerName = textValue(buyer.label ?? buyer.name ?? row.buyerName)
  const total = nullableNumber(row.totalReceivable ?? row.totalAmount)
  const due = nullableNumber(row.outstanding ?? row.outstandingAmount)
  const cows = lines.map((line) => ({
    code: textValue(line.cattleCode), tag: textValue(line.earTagNumber, '—'), backendId: numberValue(line.cattleId),
    breed: `${textValue(line.breedName, 'Bò')} · ${line.sex === 'MALE' ? 'Đực' : 'Cái'}`,
    weight: numberValue(line.exitWeightKg), estimated: Boolean(line.estimated), barn: textValue(line.penCode),
    current: statusFromBackend(row.status) === 'Đã xuất' ? 'EXITED' : textValue(line.herdStatus), amount: numberValue(line.lineAmount), unitPrice: numberValue(line.unitPrice),
  }))
  const detail: ExitDetail = {
    death: Boolean(row.loss), lossType: textValue(row.lossKind), date: textValue(row.exitDate),
    reason: textValue(row.deathCause), disposal: textValue(row.carcassDisposal), buyer: buyerName,
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note),
    by: textValue(asRecord(row.confirmedBy).label ?? row.confirmedBy, '—'),
    cows,
    cowsTotal: numberValue(row.cattleAmount), deduction: numberValue(row.deductions), payments: paymentRows(row.payments), docs: [],
    history: asRows(row.history).map((item) => textValue(item.text ?? item.type)).filter(Boolean),
  }
  if (Boolean(row.loss)) {
    detail.cow = cows[0]
    detail.source = textValue(asRecord(row.sourceHealthCase).label)
    detail.reporter = textValue(asRecord(row.reportedBy).label)
    detail.barnShift = textValue(lines[0]?.penCode)
  }
  const draft: ExitDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.exitType), date: textValue(row.exitDate), buyerId: buyer.id == null ? '' : String(buyer.id),
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note),
    pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg', deduction: numberValue(row.deductions), collected: numberValue(row.depositCollected ?? row.amountCollected),
    method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', dueDate: textValue(row.collectionDueDate),
    cows: lines.map((line) => ({
      code: textValue(line.cattleCode), backendId: numberValue(line.cattleId), tag: textValue(line.earTagNumber), breed: textValue(line.breedName), sex: line.sex === 'MALE' ? 'Đực' : 'Cái',
      barn: textValue(line.penCode), weight: numberValue(line.exitWeightKg), unitPrice: numberValue(line.unitPrice), estimated: Boolean(line.estimated),
    })),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: numberValue(row.version), date: textValue(row.exitDate),
    type: typeFromBackend(row.exitType), who: buyerName || textValue(row.destination ?? row.deathCause),
    sub: textValue(row.note), count: numberValue(row.cattleCount, lines.length), weight: numberValue(row.totalWeightKg),
    total, due, status: statusFromBackend(row.status), detail, draft, reason: textValue(row.closeReason), cancelReason: textValue(row.closeReason), note: textValue(row.note),
  }
}

const findNamedId = (rows: unknown, name: string): number | null => {
  const wanted = name.trim().toLocaleLowerCase('vi')
  const match = asRows(rows).find((row) => textValue(row.name ?? row.label).trim().toLocaleLowerCase('vi') === wanted)
  return match ? nullableNumber(match.id) : null
}

export function createHerdExitBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number }) {
  const root = transport.farmPath(farmId, '/exit-vouchers')
  const list = async (): Promise<HerdExit[]> => {
    const body = asRecord(await transport.get(root))
    return asRows(body.vouchers).map(mapVoucher)
  }
  const resolve = async (code: string): Promise<{ backendId: number; version: number }> => {
    const row = (await list()).find((item) => item.id === code)
    if (!row) throw new Error(`Không tìm thấy phiếu xuất ${code}`)
    return { backendId: numberValue(row.backendId), version: numberValue(row.version) }
  }
  const get = async (code: string): Promise<HerdExit> => {
    const { backendId } = await resolve(code)
    return mapVoucher(await transport.get(`${root}/${backendId}`))
  }
  const save = async ({ id, record, cattleRows = [] }: SaveInput): Promise<HerdExit> => {
    const current = id ? await get(id).catch(() => null) : null
    if (current) {
      record = {
        ...current,
        ...record,
        detail: { ...current.detail, ...record.detail },
        draft: record.draft ?? current.draft,
      }
    }
    const draft = record.draft ?? {}
    const detail = record.detail ?? {}
    const existing = current ? { backendId: numberValue(current.backendId), version: numberValue(current.version) } : null
    const [partners, selectable] = await Promise.all([
      transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER')),
      transport.get(`${root}/selectable-cattle`),
    ])
    const buyerName = textValue(detail.buyer ?? record.who)
    const buyerId = exitType(record.type) === 'SALE'
      ? nullableNumber(draft.buyerId) ?? findNamedId(partners, buyerName)
      : null
    const selectableRows = asRows(selectable)
    const body = {
      exitType: exitType(record.type), exitDate: textValue(record.date ?? draft.date), buyerId,
      destination: exitType(record.type) === 'SALE' ? null : textValue(record.who) || null,
      transportCertNo: textValue(draft.quarantine ?? detail.quarantine) || null, vehiclePlate: textValue(draft.plate ?? detail.plate) || null,
      note: textValue(draft.note ?? detail.note ?? record.note) || null,
      lossKind: exitType(record.type) === 'DEATH' ? (textValue(detail.lossType).toLowerCase().includes('mất') ? 'MISSING' : 'DIED') : null,
      deathCause: exitType(record.type) === 'DEATH' ? textValue(detail.reason ?? record.reason ?? record.note) || null : null,
      carcassDisposal: exitType(record.type) === 'DEATH' ? textValue(detail.disposal) || null : null,
      pricingBasis: pricingBasis(draft.pricing), deductions: numberValue(draft.deduction ?? detail.deduction),
      depositCollected: numberValue(draft.collected), paymentMethod: enumPaymentMethod(draft.method), collectionDueDate: textValue(draft.dueDate) || null,
      lines: cattleRows.map((cow) => {
        const match = selectableRows.find((item) => textValue(item.cattleCode) === textValue(cow.code))
        const cattleId = nullableNumber(cow.backendId) ?? nullableNumber(match?.cattleId)
        if (!cattleId) throw new Error(`Bò ${textValue(cow.code)} không còn đủ điều kiện xuất`)
        return { cattleId, exitWeightKg: numberValue(cow.weight), weightBasis: cow.estimated ? 'ESTIMATED' : 'MEASURED', unitPrice: numberValue(cow.unitPrice) }
      }),
      expectedVersion: existing?.version ?? null,
    }
    const saved = unwrapVoucher(await transport.command(existing ? `${root}/${existing.backendId}` : root, body, existing ? { method: 'PUT' } : undefined))
    if (record.status !== 'Đã xuất') return mapVoucher(saved)
    const confirmed = await transport.command(`${root}/${numberValue(saved.id)}/confirm`, { acknowledged: true, expectedVersion: numberValue(saved.version) })
    return mapVoucher(unwrapVoucher(confirmed))
  }
  const voidVoucher = async (code: string, reason: string): Promise<HerdExit> => {
    const current = await resolve(code)
    const result = await transport.command(`${root}/${current.backendId}/void`, { reason, penOverrides: {}, warningReasons: {}, expectedVersion: current.version })
    return mapVoucher(unwrapVoucher(result))
  }
  const recordPayment = async (code: string, payment: PaymentInput): Promise<HerdExit> => {
    const current = await resolve(code)
    await transport.command(transport.farmPath(farmId, `/vouchers/exit/${current.backendId}/payments`), {
      paymentDate: isoDate(payment.date), amount: payment.amount, method: enumPaymentMethod(payment.method), reference: payment.ref || null,
      note: payment.note || null, voucherVersion: current.version,
    })
    return get(code)
  }
  const dismissVoucher = async (code: string, reason: string): Promise<HerdExit> => {
    const current = await resolve(code)
    const result = await transport.command(`${root}/${current.backendId}/dismiss`, { reason, expectedVersion: current.version })
    return mapVoucher(unwrapVoucher(result))
  }
  const selectableCattle = async (): Promise<ExitCandidate[]> => asRows(await transport.get(`${root}/selectable-cattle`)).map((row) => {
    const latest = asRecord(row.latestWeight)
    const months = numberValue(row.ageMonths)
    const result: ExitCandidate = {
      code: textValue(row.cattleCode), tag: textValue(row.earTagNumber), breed: textValue(row.breedName),
      sex: row.sex === 'MALE' ? 'Đực' : 'Cái', age: months ? `${months} tháng` : '—', group: textValue(row.herdGroup),
      stage: textValue(row.lifeStage), barn: textValue(row.penCode), weight: numberValue(latest.weightKg),
      weightNote: latest.basis === 'ESTIMATED' ? `ước tính ${textValue(latest.date)}` : `cân ${textValue(latest.date)}`,
      estimated: latest.basis === 'ESTIMATED', unitPrice: 92000,
    }
    const withdrawalUntil = textValue(row.withdrawalEndDate)
    const openCaseId = nullableNumber(row.openCaseId)
    if (withdrawalUntil) result.withdrawalUntil = withdrawalUntil
    if (openCaseId) result.openCase = `HC-${openCaseId}`
    return result
  })
  const buyers = async () => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone),
  }))
  return { list, get, save, voidVoucher, dismissVoucher, recordPayment, selectableCattle, buyers }
}
