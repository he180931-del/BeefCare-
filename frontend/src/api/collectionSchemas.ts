import { createCollectionSchema, type CollectionRow, type CollectionSchema } from './client'
import type { Cattle, HerdEntry, HerdExit, Pen } from '../types'

export const asRecord = (value: unknown, label: string): CollectionRow => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}: expected object`)
  return value as CollectionRow
}

const requiredString = (row: CollectionRow, key: string, label: string): string => {
  if (typeof row[key] !== 'string' || row[key] === '') throw new Error(`Invalid ${label}: ${key}`)
  return row[key]
}

const optionalObject = (value: unknown, label: string): CollectionRow | undefined => {
  if (value === undefined) return undefined
  return asRecord(value, label)
}

export const parseCattle = (value: unknown): Cattle => {
  const row = asRecord(value, 'cattle')
  const code = requiredString(row, 'code', 'cattle')
  const status = row.status
  if (status !== 'ACTIVE' && status !== 'EXITED' && status !== 'VOIDED') throw new Error('Invalid cattle: status')
  if (row.barn !== null && row.barn !== undefined && typeof row.barn !== 'string') throw new Error('Invalid cattle: barn')
  return { ...row, code, barn: row.barn === undefined ? null : row.barn, status } as Cattle
}

export const parsePen = (value: unknown): Pen => {
  const row = asRecord(value, 'pen')
  const code = requiredString(row, 'code', 'pen')
  const name = requiredString(row, 'name', 'pen')
  if (typeof row.count !== 'number' || typeof row.capacity !== 'number') throw new Error('Invalid pen: capacity/count')
  if (row.status !== 'ACTIVE' && row.status !== 'INACTIVE') throw new Error('Invalid pen: status')
  if (!Array.isArray(row.cows) || row.cows.some((link) => !Array.isArray(link) || link.length < 2 || typeof link[0] !== 'string' || typeof link[1] !== 'string')) throw new Error('Invalid pen: cows')
  return { ...row, code, name, count: row.count, capacity: row.capacity, status: row.status, cows: row.cows } as Pen
}

export const parseHerdEntry = (value: unknown): HerdEntry => {
  const row = asRecord(value, 'herd entry')
  const id = requiredString(row, 'id', 'herd entry')
  if (row.status !== 'Nháp' && row.status !== 'Đã nhập' && row.status !== 'Đã hủy') throw new Error('Invalid herd entry: status')
  const detail = optionalObject(row.detail, 'herd entry detail')
  const draft = optionalObject(row.draft, 'herd entry draft')
  return { ...row, id, status: row.status, ...(detail ? { detail } : {}), ...(draft ? { draft } : {}) } as HerdEntry
}

export const parseHerdExit = (value: unknown): HerdExit => {
  const row = asRecord(value, 'herd exit')
  const id = requiredString(row, 'id', 'herd exit')
  if (row.status !== 'Nháp' && row.status !== 'Chờ xác nhận' && row.status !== 'Đã xuất' && row.status !== 'Đã hủy' && row.status !== 'Đã bác') throw new Error('Invalid herd exit: status')
  const detail = optionalObject(row.detail, 'herd exit detail')
  const draft = optionalObject(row.draft, 'herd exit draft')
  return { ...row, id, status: row.status, ...(detail ? { detail } : {}), ...(draft ? { draft } : {}) } as HerdExit
}

export const cattleSchema: CollectionSchema<Cattle, 'code'> = createCollectionSchema('cattle-v1', 'code', parseCattle)
export const penSchema: CollectionSchema<Pen, 'code'> = createCollectionSchema('pens-v1', 'code', parsePen)
export const herdEntrySchema: CollectionSchema<HerdEntry, 'id'> = createCollectionSchema('herd-entries-v1', 'id', parseHerdEntry)
export const herdExitSchema: CollectionSchema<HerdExit, 'id'> = createCollectionSchema('herd-exits-v1', 'id', parseHerdExit)
