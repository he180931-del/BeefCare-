import { describe, expect, it } from 'vitest'
import { evaluatePurchaseEntryChecks } from '../../../src/features/herd-entry/domain/purchaseEntryChecks'
import type { EntryCow } from '../../../src/features/herd-entry/types'
import type { Pen } from '../../../src/features/pen-management'

const cow = (patch: Partial<EntryCow> = {}): EntryCow => ({
  tag: '', name: '', breed: 'Bò lai', sex: 'Cái', dob: '', dobAccuracy: 'UNKNOWN', stage: 'Bò cái', purpose: 'Sinh sản',
  weight: 250, estimated: false, weightBasis: 'MEASURED', barn: 'A1', unitPrice: 100, hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' }, ...patch,
})
const pen = (capacity = 3): Pen => ({ code: 'A1', name: 'A1', count: 1, capacity, status: 'ACTIVE', cows: [] })
const evaluate = (cows: EntryCow[], options: { capacity?: number; date?: string; quarantine?: string; pricing?: 'kg' | 'con' } = {}) => evaluatePurchaseEntryChecks({
  cows, pricing: options.pricing ?? 'kg', date: options.date ?? '2026-10-28', today: '2026-10-28', pens: [pen(options.capacity)], quarantine: options.quarantine ?? 'QC-1',
})

describe('evaluatePurchaseEntryChecks', () => {
  it('normalizes duplicate tags case-insensitively like EntryLineValidator', () => {
    expect(evaluate([cow({ tag: ' Ab-1 ' }), cow({ tag: 'ab-1' })]).hasDuplicateTags).toBe(true)
  })
  it('keeps empty rows pending rather than showing false green results', () => {
    const result = evaluate([])
    expect(result.checks.every((check) => check.status === 'pending' || check.status === 'warn')).toBe(true)
    expect(result.checks.find((check) => check.id === 'capacity')?.label).toBe('Chưa có con nào')
  })
  it('distinguishes exactly full capacity from over capacity', () => {
    expect(evaluate([cow(), cow()], { capacity: 3 }).checks.find((check) => check.id === 'capacity')?.status).toBe('warn')
    expect(evaluate([cow(), cow(), cow()], { capacity: 3 }).checks.find((check) => check.id === 'capacity')?.status).toBe('error')
  })
  it('uses business date and ignores UNKNOWN birth dates in date checks', () => {
    const result = evaluate([cow({ dob: '2026-11-01', dobAccuracy: 'UNKNOWN' })], { date: '2026-10-29' })
    expect(result.invalidEntryDate).toBe(true)
    expect(evaluate([cow({ dob: '2026-11-01', dobAccuracy: 'UNKNOWN' })]).invalidEntryDate).toBe(false)
  })
  it('flags missing quarantine and checks weight only for per-kg pricing', () => {
    const perHead = evaluate([cow({ weight: 0 })], { pricing: 'con', quarantine: '' })
    expect(perHead.checks.find((check) => check.id === 'weight')?.status).toBe('pending')
    expect(perHead.checks.find((check) => check.id === 'quarantine')?.status).toBe('warn')
    expect(evaluate([cow({ weight: 0 })]).warningsByLine[0]).toContain('Chưa có cân khi tính theo kg.')
  })
})
