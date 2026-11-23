import { useRef, useState } from 'react'
import { correctEntryLine, entryVoidCheck, listEntryBreeds, listEntrySellers, listEntryVaccines, voidEntryLine } from '../api'
import type { EntryHistory } from '../domain/entryHistory'
import { useQuery } from '../../../shared/hooks/useQuery'
import { buildEntryLineChanges, emptyEntryLineForm, isFarmBornEntry, type EntryLineForm } from '../domain/entryLineCorrection'
import type { EntryCattleDetail, EntryLineCommandResult, HerdEntry } from '../types'

export function useEntryLineCorrection(record: HerdEntry, line: EntryCattleDetail, onSuccess: (result: EntryLineCommandResult) => Promise<void>) {
  const [snapshot] = useState(() => ({ record, line }))
  const [form, setForm] = useState(emptyEntryLineForm)
  const [history, setHistory] = useState<EntryHistory>()
  const [reason, setReason] = useState('')
  const [action, setAction] = useState<'correct' | 'void'>('correct')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef(false)
  const purchase = !isFarmBornEntry(snapshot.record)
  const query = useQuery(async () => {
    if (snapshot.line.entryId == null) throw new Error('Không tìm thấy bản ghi nhập.')
    const [check, breeds, sellers, vaccines] = await Promise.all([
      entryVoidCheck(snapshot.line.entryId), purchase ? listEntryBreeds() : Promise.resolve([]), purchase ? listEntrySellers() : Promise.resolve([]),
      purchase ? listEntryVaccines() : Promise.resolve([]),
    ])
    return { check, breeds, sellers, vaccines }
  }, [snapshot.line.entryId])
  const validCount = snapshot.record.detail?.cows?.filter(item => item.lineStatus === 'VALID').length ?? 0
  const lastValid = validCount === 1
  const canVoid = query.data?.check.canVoid === true && validCount > 1
  const draft = buildEntryLineChanges(snapshot.record, snapshot.line, form, history)
  const validReason = reason.trim().length > 0 && reason.trim().length <= 500
  const canSave = !saving && !query.loading && !query.error && Boolean(query.data) && validReason
    && (action === 'void' ? canVoid : !draft.error && Object.keys(draft.changes).length > 0)
  const submit = async () => {
    if (!canSave || inFlight.current || snapshot.line.entryId == null) return
    if (action === 'void' && !confirming) { setConfirming(true); return }
    inFlight.current = true
    setSaving(true); setError(null)
    try {
      const input = { reason: reason.trim(), expectedVersion: snapshot.line.lineVersion }
      const result = action === 'void'
        ? await voidEntryLine(snapshot.line.entryId, input)
        : await correctEntryLine(snapshot.line.entryId, { ...input, voucherVersion: snapshot.record.version, changes: draft.changes })
      await onSuccess(result)
    } catch (nextError) { setError(nextError) }
    finally { inFlight.current = false; setSaving(false) }
  }
  return {
    record: snapshot.record, line: snapshot.line, purchase, form, history, setHistory, reason, setReason, action,
    setAction: (value: 'correct' | 'void') => { setAction(value); setConfirming(false) },
    update: (key: keyof EntryLineForm, value: string) => setForm(current => ({ ...current, [key]: value })),
    confirming, back: () => setConfirming(false), saving, error, canSave, canVoid, lastValid,
    loading: query.loading, loadError: query.error, retry: query.refetch, data: query.data, validationError: draft.error, submit,
  }
}
