import { useState } from 'react'
import { exitCollectionDefaults, herdExitApi } from '../api/index'
import { useMutation } from '../../../shared/hooks/useMutation'
import type { HerdExit } from '../types'
import type { VoucherPaymentSnapshot } from '../../../shared/api/snapshotVersion'

export function isValidCollectionAmount(amount: number, owed: number) {
  return amount > 0 && amount <= owed
}

export function useExitCollection(row: HerdExit, onSaved?: () => void, onClose?: () => void) {
  const { mutate: recordPayment, loading: saving, error } = useMutation<{ id: string; payment: { date: string; amount: number; method: string; ref: string; note?: string }; snapshot: VoucherPaymentSnapshot }, HerdExit>(({ id, payment, snapshot }) => herdExitApi.recordPayment(id, payment, snapshot))
  const payments = row.detail?.payments ?? []
  const collected = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const total = row.total
  const owed = row.due ?? 0
  const [defaults] = useState(exitCollectionDefaults)
  const [date, setDate] = useState(defaults.date)
  const [amount, setAmount] = useState(owed)
  const [method, setMethod] = useState('Chuyển khoản')
  const [reference, setReference] = useState(defaults.reference)
  const [showStatement, setShowStatement] = useState(defaults.statement)
  const [note, setNote] = useState(defaults.note)
  const valid = isValidCollectionAmount(amount, owed)
  const left = owed - amount

  const save = async () => {
    await recordPayment({ id: row.id, snapshot: { voucherVersion: row.version, backendId: row.backendId }, payment: { date, method, ref: method === 'Tiền mặt' && defaults.cashReference ? defaults.cashReference : reference, amount, note } })
    onSaved?.()
    onClose?.()
  }

  return { defaults, payments, collected, total, owed, date, setDate, amount, setAmount, method, setMethod, reference, setReference, showStatement, setShowStatement, note, setNote, valid, left, saving, error, save }
}
