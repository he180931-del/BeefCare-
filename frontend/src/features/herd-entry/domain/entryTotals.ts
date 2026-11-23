import type { EntryCow, EntryCalf } from '../types'
import type { Pen } from '../../pen-management'

export const lineAmount = (cow: EntryCow, pricing: 'kg' | 'con') => pricing === 'con'
  ? (cow.unitPrice ?? 0)
  : (cow.weight ?? 0) * (cow.unitPrice ?? 0)

export const purchaseTotals = (cows: EntryCow[], pricing: 'kg' | 'con', freight: number, paid: number) => {
  const cattleAmount = cows.reduce((sum, cow) => sum + lineAmount(cow, pricing), 0)
  const total = cattleAmount + freight
  return {
    cattleAmount,
    totalWeight: cows.reduce((sum, cow) => sum + (cow.weight ?? 0), 0),
    total,
    debt: Math.max(total - paid, 0),
    estimatedCount: cows.filter((cow) => cow.estimated).length,
  }
}

export const receivingPenAfter = (pens: Pen[], cows: EntryCow[]) => pens
  .map((pen) => ({ ...pen, after: pen.count + cows.filter((cow) => cow.barn === pen.code).length }))
  .filter((pen) => pen.after !== pen.count)

export const receivingPenOverflow = (pens: Pen[], cows: EntryCow[]) => receivingPenAfter(pens, cows)
  .filter((pen) => pen.after > pen.capacity)

export const calfTotals = (calves: EntryCalf[], pens: Pen[], fallbackPenCode?: string) => {
  const picked = calves.filter((calf) => calf.picked)
  const fallbackPen = pens.find((pen) => pen.code === fallbackPenCode)
  const calfOver = picked.some((calf) => {
    const pen = pens.find((candidate) => candidate.code === calf.barn)
    const count = picked.filter((row) => row.barn === calf.barn).length
    return !pen || pen.status !== 'ACTIVE' || pen.count + count > pen.capacity
  })
  return {
    picked,
    weight: picked.reduce((sum, calf) => sum + calf.weight, 0),
    estimatedCount: picked.filter((calf) => calf.estimated).length,
    after: (fallbackPen?.count ?? 0) + picked.length,
    over: calfOver,
  }
}
