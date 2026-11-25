import { useState } from 'react'
import { downloadEntryAttachment, herdEntryApi, voidHerdEntry } from '../api'
import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import type { CattleInput } from '../../cattle'
import type { EntryDetail, EntryPayment, EntryVoidOutcome, HerdEntry } from '../types'
import { herdEntryError } from '../api/herdEntryError'
import type { VoucherPaymentSnapshot, VoucherSnapshot } from '../../../shared/api/snapshotVersion'
import { entryPaymentTotals } from '../domain/entryPaymentTotals'
import { money } from '../../../shared/lib/format'

export function useEntryDetail(recordId: string) {
  const [documentError, setDocumentError] = useState<string | null>(null)
  const query = useQuery<HerdEntry>(() => herdEntryApi.get(recordId), [recordId])
  const payment = useMutation<{ recordId: string; payment: EntryPayment & { note?: string }; snapshot: VoucherPaymentSnapshot }, HerdEntry>(({ recordId: targetId, payment: value, snapshot }) => herdEntryApi.recordPayment(targetId, value, snapshot))
  const cancellation = useMutation<{ recordId: string; cattleRows: CattleInput[]; patch: Partial<HerdEntry>; snapshot: VoucherSnapshot }, EntryVoidOutcome>(({ recordId: targetId, cattleRows, patch, snapshot }) => voidHerdEntry(targetId, cattleRows, patch, snapshot))
  const record = query.data
  const detail: EntryDetail = { cows: [], payments: [], docs: [], history: [], ...record?.detail }
  const canPay = Boolean(record && entryPaymentTotals(record).outstanding > 0 && record.status === 'Đã nhập')
  const canCancel = Boolean(record && record.status === 'Đã nhập' && detail.cows?.length)

  /** Records a payment and returns MSG-FE06-14 with the outstanding amount of the reloaded voucher. */
  const savePayment = async (value: EntryPayment): Promise<string | undefined> => {
    if (!record) return undefined
    await payment.mutate({ recordId: record.id, payment: value, snapshot: { voucherVersion: record.version, backendId: record.backendId } })
    const latest = await query.refetch()
    if (!latest) return undefined
    return `Đã ghi ${money(value.amount)} đ cho ${latest.id}. Còn lại: ${money(entryPaymentTotals(latest).outstanding)} đ.`
  }

  /** Voids the whole voucher and returns MSG-FE06-22. */
  const cancelRecord = async (reason: string): Promise<string | undefined> => {
    if (!record) return undefined
    const outcome = await cancellation.mutate({
      recordId: record.id,
      snapshot: { expectedVersion: record.version, backendId: record.backendId },
      cattleRows: detail.cows ?? [],
      patch: {
        status: 'Đã hủy',
        cancelReason: reason,
        source: `${record.source} · Hủy: ${reason}`,
        detail,
      },
    })
    await query.refetch()
    return outcome.notice
  }

  const viewDocument = async (index: number) => {
    const document = detail.docs?.[index]
    if (!document) return
    const attachmentId = Number(document.id)
    try {
      const blob = Number.isFinite(attachmentId) && attachmentId > 0
        ? await downloadEntryAttachment(recordId, attachmentId)
        : null
      const url = blob ? URL.createObjectURL(blob) : typeof document.url === 'string' ? document.url : null
      if (!url) throw new Error('Không tìm thấy nội dung chứng từ')
      window.open(url, '_blank', 'noopener,noreferrer')
      if (blob) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setDocumentError(null)
    } catch (error) {
      setDocumentError(herdEntryError(error))
    }
  }

  return {
    record,
    detail,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    reload: async () => { const latest = await herdEntryApi.get(recordId); query.setData(latest) },
    paymentError: payment.error,
    paymentSaving: payment.loading,
    voidError: cancellation.error,
    voidSaving: cancellation.loading,
    documentError,
    canPay,
    canCancel,
    savePayment,
    cancelRecord,
    viewDocument,
  }
}
