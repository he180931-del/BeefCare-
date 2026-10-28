import { createCollectionSchema, type CollectionRow, type CollectionSchema } from './client'
import type { Cattle, DocumentRow, EntryCalf, EntryCow, EntryDraft, ExitDraft, ExitDraftCow, HerdEntry, HerdExit, Pen } from '../types'

export const asRecord = (value: unknown, label: string): CollectionRow => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}: expected object`)
  return value as CollectionRow
}

const requiredString = (row: CollectionRow, key: string, label: string): string => {
  if (typeof row[key] !== 'string' || row[key] === '') throw new Error(`Invalid ${label}: ${key}`)
  return row[key]
}

const stringValue = (row: CollectionRow, key: string, label: string): string => {
  if (typeof row[key] !== 'string') throw new Error(`Invalid ${label}: ${key}`)
  return row[key]
}

const optionalStringValue = (row: CollectionRow, key: string, label: string): string | undefined => {
  const value = row[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`Invalid ${label}: ${key}`)
  return value
}

const optionalString = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && typeof row[key] !== 'string') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalNumber = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && typeof row[key] !== 'number') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalNumberOrNull = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && row[key] !== null && typeof row[key] !== 'number') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalStringNumberOrNull = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && row[key] !== null && typeof row[key] !== 'string' && typeof row[key] !== 'number') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalBoolean = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && typeof row[key] !== 'boolean') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalStringOrNull = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] !== undefined && row[key] !== null && typeof row[key] !== 'string') throw new Error(`Invalid ${label}: ${key}`)
}

const optionalObjectOrNull = (row: CollectionRow, key: string, label: string): CollectionRow | null | undefined => {
  if (row[key] === undefined || row[key] === null) return row[key] as null | undefined
  return asRecord(row[key], label)
}

const enumValue = <T extends string>(row: CollectionRow, key: string, values: readonly T[], label: string): T | undefined => {
  const value = row[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`Invalid ${label}: ${key}`)
  const match = values.find((candidate) => candidate === value)
  if (match === undefined) throw new Error(`Invalid ${label}: ${key}`)
  return match
}

const stringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`Invalid ${label}`)
  return value
}

const optionalArray = <T>(row: CollectionRow, key: string, parse: (value: unknown) => T, label: string): T[] | undefined => {
  if (row[key] === undefined) return undefined
  if (!Array.isArray(row[key])) throw new Error(`Invalid ${label}: ${key}`)
  return row[key].map(parse)
}

const parseHistoryRecord = (value: unknown, label: string): CollectionRow => {
  const row = asRecord(value, label)
  for (const key of ['from', 'to', 'barn', 'reason', 'by', 'date', 'type', 'note', 'label']) optionalString(row, key, label)
  return row
}

const parseQrHistoryRecord = (value: unknown): CollectionRow => {
  const row = asRecord(value, 'cattle QR history')
  optionalString(row, 'status', 'cattle QR history')
  return row
}

const optionalStringTupleArray = (row: CollectionRow, key: string, label: string): void => {
  if (row[key] === undefined) return
  if (!Array.isArray(row[key]) || row[key].some((item) => !Array.isArray(item) || item.length < 2 || typeof item[0] !== 'string' || typeof item[1] !== 'string')) throw new Error(`Invalid ${label}: ${key}`)
}

const validateCare = (value: unknown): void => {
  const row = asRecord(value, 'cattle care')
  for (const key of ['last', 'adg', 'bcs', 'healthCase', 'repro']) optionalString(row, key, 'cattle care')
  if (row.vaccine !== undefined) {
    const vaccine = asRecord(row.vaccine, 'cattle care vaccine')
    optionalString(vaccine, 'label', 'cattle care vaccine')
  }
  if (row.reminders !== undefined) {
    if (!Array.isArray(row.reminders) || row.reminders.some((item) => typeof item !== 'object' || item === null || Array.isArray(item))) throw new Error('Invalid cattle care reminders')
  }
}

const parseDocument = (value: unknown): DocumentRow => {
  const row = asRecord(value, 'document')
  const name = requiredString(row, 'name', 'document')
  optionalString(row, 'ext', 'document')
  return { ...row, name }
}

const parsePayment = (value: unknown): CollectionRow => {
  const row = asRecord(value, 'payment')
  requiredString(row, 'date', 'payment')
  requiredString(row, 'by', 'payment')
  requiredString(row, 'method', 'payment')
  stringValue(row, 'ref', 'payment')
  if (typeof row.amount !== 'number') throw new Error('Invalid payment: amount')
  return row
}

const parseCattleDetail = (value: unknown): CollectionRow => {
  const row = asRecord(value, 'cattle detail')
  optionalString(row, 'code', 'cattle detail')
  optionalString(row, 'tag', 'cattle detail')
  optionalString(row, 'breed', 'cattle detail')
  optionalString(row, 'sex', 'cattle detail')
  optionalStringOrNull(row, 'barn', 'cattle detail')
  optionalString(row, 'current', 'cattle detail')
  optionalString(row, 'name', 'cattle detail')
  optionalString(row, 'dob', 'cattle detail')
  optionalString(row, 'dobAccuracy', 'cattle detail')
  optionalString(row, 'stage', 'cattle detail')
  optionalString(row, 'purpose', 'cattle detail')
  optionalString(row, 'age', 'cattle detail')
  optionalNumberOrNull(row, 'weight', 'cattle detail')
  optionalNumber(row, 'amount', 'cattle detail')
  optionalBoolean(row, 'estimated', 'cattle detail')
  optionalNumber(row, 'unitPrice', 'cattle detail')
  if (row.events !== undefined) stringArray(row.events, 'cattle detail events')
  if (row.caseLine !== undefined) stringArray(row.caseLine, 'cattle detail caseLine')
  if (row.hist !== undefined) {
    const hist = asRecord(row.hist, 'cattle detail hist')
    requiredString(hist, 'vaccine', 'cattle detail hist')
    optionalString(hist, 'vaccineNote', 'cattle detail hist')
    requiredString(hist, 'disease', 'cattle detail hist')
    requiredString(hist, 'repro', 'cattle detail hist')
  }
  return row
}

const parseEntryDetail = (value: unknown): CollectionRow => {
  const row = asRecord(value, 'entry detail')
  for (const key of ['sourceName', 'quarantine', 'phone', 'plate', 'by', 'note']) optionalString(row, key, 'entry detail')
  optionalNumber(row, 'cowsTotal', 'entry detail')
  optionalNumber(row, 'freight', 'entry detail')
  optionalArray(row, 'cows', parseCattleDetail, 'entry detail')
  optionalArray(row, 'payments', parsePayment, 'entry detail')
  optionalArray(row, 'docs', parseDocument, 'entry detail')
  if (row.history !== undefined) stringArray(row.history, 'entry detail history')
  return row
}

const parseCalf = (value: unknown): EntryCalf => {
  const row = asRecord(value, 'entry draft calf')
  const name = stringValue(row, 'name', 'entry draft calf')
  const tag = stringValue(row, 'tag', 'entry draft calf')
  const mother = stringValue(row, 'mother', 'entry draft calf')
  const father = stringValue(row, 'father', 'entry draft calf')
  const born = stringValue(row, 'born', 'entry draft calf')
  const sex = stringValue(row, 'sex', 'entry draft calf')
  const purpose = stringValue(row, 'purpose', 'entry draft calf')
  const barn = stringValue(row, 'barn', 'entry draft calf')
  if (typeof row.weight !== 'number') throw new Error('Invalid entry draft calf: weight')
  if (typeof row.estimated !== 'boolean') throw new Error('Invalid entry draft calf: estimated')
  if (typeof row.picked !== 'boolean') throw new Error('Invalid entry draft calf: picked')
  const parsed: EntryCalf = { ...row, name, tag, mother, father, born, sex, weight: row.weight, estimated: row.estimated, purpose, picked: row.picked, barn }
  return parsed
}

const parseEntryCow = (value: unknown): EntryCow => {
  const row = asRecord(value, 'entry draft cow')
  const tag = stringValue(row, 'tag', 'entry draft cow')
  const name = stringValue(row, 'name', 'entry draft cow')
  const breed = stringValue(row, 'breed', 'entry draft cow')
  const sex = stringValue(row, 'sex', 'entry draft cow')
  const dob = stringValue(row, 'dob', 'entry draft cow')
  const dobAccuracy = stringValue(row, 'dobAccuracy', 'entry draft cow')
  const stage = stringValue(row, 'stage', 'entry draft cow')
  const purpose = stringValue(row, 'purpose', 'entry draft cow')
  const barn = stringValue(row, 'barn', 'entry draft cow')
  const code = optionalStringValue(row, 'code', 'entry draft cow')
  optionalString(row, 'group', 'entry draft cow')
  optionalNumber(row, 'ageMonths', 'entry draft cow')
  if (typeof row.weight !== 'number') throw new Error('Invalid entry draft cow: weight')
  if (typeof row.estimated !== 'boolean') throw new Error('Invalid entry draft cow: estimated')
  if (typeof row.unitPrice !== 'number') throw new Error('Invalid entry draft cow: unitPrice')
  const hist = asRecord(row.hist, 'entry draft cow hist')
  const vaccineNote = optionalStringValue(hist, 'vaccineNote', 'entry draft cow hist')
  const parsedHist = {
    ...hist,
    vaccine: requiredString(hist, 'vaccine', 'entry draft cow hist'),
    disease: requiredString(hist, 'disease', 'entry draft cow hist'),
    repro: requiredString(hist, 'repro', 'entry draft cow hist'),
    ...(vaccineNote !== undefined ? { vaccineNote } : {}),
  }
  const parsed: EntryCow = { ...row, ...(code !== undefined ? { code } : {}), tag, name, breed, sex, dob, dobAccuracy, stage, purpose, weight: row.weight, estimated: row.estimated, barn, unitPrice: row.unitPrice, hist: parsedHist }
  return parsed
}

const parseEntryDraft = (value: unknown): EntryDraft => {
  const row = asRecord(value, 'entry draft')
  const type = enumValue(row, 'type', ['Mua ngoài', 'Bê sinh tại trại'] as const, 'entry draft')
  const pricing = enumValue(row, 'pricing', ['kg', 'con'] as const, 'entry draft')
  for (const key of ['date', 'sourceId', 'quarantine', 'receiver', 'note', 'method', 'due']) optionalString(row, key, 'entry draft')
  for (const key of ['freight', 'paid']) optionalNumber(row, key, 'entry draft')
  optionalBoolean(row, 'printQr', 'entry draft')
  const cows = optionalArray(row, 'cows', parseEntryCow, 'entry draft')
  const calves = optionalArray(row, 'calves', parseCalf, 'entry draft')
  const docs = optionalArray(row, 'docs', parseDocument, 'entry draft')
  const parsed: EntryDraft = {
    ...row,
    ...(type !== undefined ? { type } : {}),
    ...(pricing !== undefined ? { pricing } : {}),
    ...(cows !== undefined ? { cows } : {}),
    ...(calves !== undefined ? { calves } : {}),
    ...(docs !== undefined ? { docs } : {}),
  }
  return parsed
}

const parseExitDetail = (value: unknown): CollectionRow => {
  const row = asRecord(value, 'exit detail')
  optionalBoolean(row, 'death', 'exit detail')
  for (const key of ['lossType', 'date', 'source', 'reporter', 'reason', 'disposal', 'buyer', 'barnShift']) optionalString(row, key, 'exit detail')
  optionalNumber(row, 'cowsTotal', 'exit detail')
  optionalNumber(row, 'deduction', 'exit detail')
  if (row.cow !== undefined) parseCattleDetail(row.cow)
  optionalArray(row, 'cows', parseCattleDetail, 'exit detail')
  optionalArray(row, 'payments', parsePayment, 'exit detail')
  optionalArray(row, 'docs', parseDocument, 'exit detail')
  if (row.history !== undefined) stringArray(row.history, 'exit detail history')
  if (row.checks !== undefined) {
    if (!Array.isArray(row.checks) || row.checks.some((check) => !Array.isArray(check) || check.length < 2 || typeof check[0] !== 'string' || typeof check[1] !== 'string' || (check[2] !== undefined && typeof check[2] !== 'boolean'))) throw new Error('Invalid exit detail checks')
  }
  return row
}

const parseExitDraftCow = (value: unknown): ExitDraftCow => {
  const row = asRecord(value, 'exit draft cow')
  const code = requiredString(row, 'code', 'exit draft cow')
  for (const key of ['tag', 'breed', 'sex', 'age', 'group', 'stage', 'barn', 'weightNote', 'withdrawalUntil', 'openCase']) optionalString(row, key, 'exit draft cow')
  if (typeof row.weight !== 'number') throw new Error('Invalid exit draft cow: weight')
  if (typeof row.unitPrice !== 'number') throw new Error('Invalid exit draft cow: unitPrice')
  if (typeof row.estimated !== 'boolean') throw new Error('Invalid exit draft cow: estimated')
  return { ...row, code, weight: row.weight, unitPrice: row.unitPrice, estimated: row.estimated }
}

const parseExitDraft = (value: unknown): ExitDraft => {
  const row = asRecord(value, 'exit draft')
  const type = enumValue(row, 'type', ['Bán', 'Chết / mất', 'Loại thải', 'Khác'] as const, 'exit draft')
  const pricing = enumValue(row, 'pricing', ['kg', 'con'] as const, 'exit draft')
  for (const key of ['date', 'buyerId', 'quarantine', 'plate', 'note', 'method', 'dueDate']) optionalString(row, key, 'exit draft')
  for (const key of ['deduction', 'collected']) optionalNumber(row, key, 'exit draft')
  const cows = optionalArray(row, 'cows', parseExitDraftCow, 'exit draft')
  const docs = optionalArray(row, 'docs', parseDocument, 'exit draft')
  const parsed: ExitDraft = {
    ...row,
    ...(type !== undefined ? { type } : {}),
    ...(pricing !== undefined ? { pricing } : {}),
    ...(cows !== undefined ? { cows } : {}),
    ...(docs !== undefined ? { docs } : {}),
  }
  return parsed
}

export const parseCattle = (value: unknown): Cattle => {
  const row = asRecord(value, 'cattle')
  const code = requiredString(row, 'code', 'cattle')
  const status = row.status
  if (status !== 'ACTIVE' && status !== 'EXITED' && status !== 'VOIDED') throw new Error('Invalid cattle: status')
  if (row.barn !== null && row.barn !== undefined && typeof row.barn !== 'string') throw new Error('Invalid cattle: barn')
  for (const key of ['tag', 'name', 'breed', 'sex', 'entryVoucherId', 'lastExitVoucherId', 'lastPen', 'withdrawalUntil', 'ageShort', 'ageLong', 'weightDate', 'purpose', 'stage', 'group', 'date', 'qr', 'barnSince', 'barnTag', 'voidVoucherId']) optionalString(row, key, 'cattle')
  for (const key of ['entryLineNo', 'ageMonths', 'months']) optionalNumber(row, key, 'cattle')
  optionalNumberOrNull(row, 'weight', 'cattle')
  optionalStringOrNull(row, 'exitVoucherId', 'cattle')
  for (const key of ['weightEst', 'estimated', 'inList']) optionalBoolean(row, key, 'cattle')
  if (row.events !== undefined) stringArray(row.events, 'cattle events')
  optionalArray(row, 'barnHistory', (item) => parseHistoryRecord(item, 'cattle barn history'), 'cattle')
  optionalArray(row, 'qrHistory', parseQrHistoryRecord, 'cattle')
  optionalStringTupleArray(row, 'headerBadges', 'cattle')
  optionalObjectOrNull(row, 'health', 'cattle health')
  optionalObjectOrNull(row, 'repro', 'cattle repro')
  if (row.care !== undefined) validateCare(row.care)
  return { ...row, code, barn: row.barn === undefined ? null : row.barn, status } as Cattle
}

export const parsePen = (value: unknown): Pen => {
  const row = asRecord(value, 'pen')
  const code = requiredString(row, 'code', 'pen')
  const name = requiredString(row, 'name', 'pen')
  if (typeof row.count !== 'number' || typeof row.capacity !== 'number') throw new Error('Invalid pen: capacity/count')
  if (row.status !== 'ACTIVE' && row.status !== 'INACTIVE') throw new Error('Invalid pen: status')
  if (!Array.isArray(row.cows) || row.cows.some((link) => !Array.isArray(link) || link.length < 2 || typeof link[0] !== 'string' || typeof link[1] !== 'string')) throw new Error('Invalid pen: cows')
  for (const key of ['accept', 'minAgeOp', 'minWeightOp', 'sex', 'tag', 'version', 'desc', 'purpose', 'stage']) optionalString(row, key, 'pen')
  for (const key of ['minAge', 'minWeight', 'minMonths', 'minKg']) optionalNumberOrNull(row, key, 'pen')
  if (row.aliases !== undefined) stringArray(row.aliases, 'pen aliases')
  if (row.events !== undefined) stringArray(row.events, 'pen events')
  optionalArray(row, 'samples', (item) => asRecord(item, 'pen sample'), 'pen')
  optionalArray(row, 'history', (item) => parseHistoryRecord(item, 'pen history'), 'pen')
  return { ...row, code, name, count: row.count, capacity: row.capacity, status: row.status, cows: row.cows } as Pen
}

export const parseHerdEntry = (value: unknown): HerdEntry => {
  const row = asRecord(value, 'herd entry')
  const id = requiredString(row, 'id', 'herd entry')
  if (row.status !== 'Nháp' && row.status !== 'Đã nhập' && row.status !== 'Đã hủy') throw new Error('Invalid herd entry: status')
  for (const key of ['date', 'source', 'cancelReason', 'quarantine']) optionalString(row, key, 'herd entry')
  for (const key of ['count', 'weight']) optionalNumber(row, key, 'herd entry')
  for (const key of ['total', 'debt']) optionalNumberOrNull(row, key, 'herd entry')
  enumValue(row, 'type', ['Mua ngoài', 'Bê sinh tại trại'], 'herd entry')
  enumValue(row, 'pricing', ['kg', 'con'], 'herd entry')
  if (row.detail !== undefined) parseEntryDetail(row.detail)
  if (row.draft !== undefined) parseEntryDraft(row.draft)
  return { ...row, id, status: row.status } as HerdEntry
}

export const parseHerdExit = (value: unknown): HerdExit => {
  const row = asRecord(value, 'herd exit')
  const id = requiredString(row, 'id', 'herd exit')
  if (row.status !== 'Nháp' && row.status !== 'Chờ xác nhận' && row.status !== 'Đã xuất' && row.status !== 'Đã hủy' && row.status !== 'Đã bác') throw new Error('Invalid herd exit: status')
  for (const key of ['date', 'who', 'sub', 'dueNote', 'reason', 'note']) optionalString(row, key, 'herd exit')
  for (const key of ['count']) optionalNumber(row, key, 'herd exit')
  optionalStringNumberOrNull(row, 'weight', 'herd exit')
  for (const key of ['total', 'due']) optionalNumberOrNull(row, key, 'herd exit')
  enumValue(row, 'type', ['Bán', 'Chết / mất', 'Loại thải', 'Khác'], 'herd exit')
  if (row.detail !== undefined) parseExitDetail(row.detail)
  if (row.draft !== undefined) parseExitDraft(row.draft)
  return { ...row, id, status: row.status } as HerdExit
}

export const cattleSchema: CollectionSchema<Cattle, 'code'> = createCollectionSchema('cattle-v1', 'code', parseCattle)
export const penSchema: CollectionSchema<Pen, 'code'> = createCollectionSchema('pens-v1', 'code', parsePen)
export const herdEntrySchema: CollectionSchema<HerdEntry, 'id'> = createCollectionSchema('herd-entries-v1', 'id', parseHerdEntry)
export const herdExitSchema: CollectionSchema<HerdExit, 'id'> = createCollectionSchema('herd-exits-v1', 'id', parseHerdExit)
