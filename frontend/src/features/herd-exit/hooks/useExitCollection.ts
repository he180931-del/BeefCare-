import { useState } from 'react'
import { exitCollectionDefaults, herdExitApi } from '../api/index'
import { useMutation } from '../../../shared/hooks/useMutation'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { dmy, money } from '../../../shared/lib/format'
import type { HerdExit } from '../types'
import type { VoucherPaymentSnapshot } from '../../../shared/api/snapshotVersion'
import { exitPaymentTotals } from '../domain/exitPaymentTotals'

export const MAX_REFERENCE = 100
export const MAX_NOTE = 500

export function isValidCollectionAmount(amount: number, owed: number) {
  return amount > 0 && amount <= owed
}

export type CollectionErrors = { date?: string; amount?: string; method?: string }

/** Popup "Ghi thu tiền" (FE-06 §6 #3–#5): date not in the future nor before the exit date, 0 < amount ≤ outstanding, method required. */
export function collectionErrors({ date, amount, method, owed, exitDate, today }: { date: string; amount: number; method: string; owed: number; exitDate?: string; today: string }): CollectionErrors {
  const errors: CollectionErrors = {}
  if (!date) errors.date = 'Ngày thu là bắt buộc.'
  else if (date > today) errors.date = 'Thời điểm không được ở tương lai.'
  else if (exitDate && date < exitDate) errors.date = `Ngày thu không hợp lệ: không được trước ngày xuất ${dmy(exitDate)}.`
  if (!(amount > 0)) errors.amount = 'Số tiền là bắt buộc.'
  else if (amount > owed) errors.amount = `Số tiền không được vượt quá ${money(owed)} đ.`
  if (!method) errors.method = 'Hình thức là bắt buộc.'
  return errors
}

export function useExitCollection(row: HerdExit, onSaved?: (message: string) => void, onClose?: () => void) {
  const { mutate: recordPayment, loading: saving, error } = useMutation<{ id: string; payment: { date: string; amount: number; method: string; ref: string; note?: string }; snapshot: VoucherPaymentSnapshot }, HerdExit>(({ id, payment, snapshot }) => herdExitApi.recordPayment(id, payment, snapshot))
  const payments = row.detail?.payments ?? []
  const { collected, outstanding: owed } = exitPaymentTotals(row)
  const total = row.total
  const [defaults] = useState(exitCollectionDefaults)
  const [date, setDate] = useState(defaults.date)
  const [amount, setAmount] = useState(owed)
  // Spec #5: required with no default; the Owner picks cash or transfer.
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState(defaults.reference)
  const [note, setNote] = useState(defaults.note)
  const [attempted, setAttempted] = useState(false)
  const errors = collectionErrors({ date, amount, method, owed, exitDate: row.date, today: businessDate() })
  const shownErrors: CollectionErrors = { date: errors.date, amount: errors.amount, ...(attempted ? { method: errors.method } : {}) }
  const valid = !errors.date && !errors.amount && !errors.method
  const left = Math.max(owed - (amount > 0 ? amount : 0), 0)

  const save = async () => {
    setAttempted(true)
    if (!valid) return
    const saved = await recordPayment({ id: row.id, snapshot: { voucherVersion: row.version, backendId: row.backendId }, payment: { date, method, ref: reference.trim(), amount, note: note.trim() } })
    const outstanding = saved?.due ?? owed - amount
    onSaved?.(`Đã ghi ${money(amount)} đ cho phiếu ${row.id}. Còn lại: ${money(outstanding)} đ.`)
    onClose?.()
  }

  return { payments, collected, total, owed, date, setDate, amount, setAmount, method, setMethod, reference, setReference, note, setNote, errors: shownErrors, valid, left, saving, error, save }
}
