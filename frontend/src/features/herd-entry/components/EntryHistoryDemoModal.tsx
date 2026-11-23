import { useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Note, Textarea } from '../../../shared/ui'
import { useQuery } from '../../../shared/hooks/useQuery'
import { correctEntryHistoryDemo, listEntryVaccines } from '../api'
import EntryHistoryDeclarationForm from './EntryHistoryDeclarationForm'
import { unknownEntryHistory, validateEntryHistory } from '../domain/entryHistory'
import type { EntryCattleDetail, HerdEntry } from '../types'

export default function EntryHistoryDemoModal({ record, line, onClose, onSaved }: {
  record: HerdEntry; line: EntryCattleDetail; onClose: () => void; onSaved: () => Promise<void>
}) {
  const [history, setHistory] = useState(() => structuredClone(line.hist ?? unknownEntryHistory()))
  const [reason, setReason] = useState(''), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const vaccines = useQuery(listEntryVaccines, [])
  const female = line.sexCode === 'FEMALE' || /Cái/.test(line.sex ?? line.breed ?? '')
  return <Modal width={720} title="Sửa khai báo lịch sử" sub={line.code} onClose={() => { if (!busy) onClose() }}>
    <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">
      <EntryHistoryDeclarationForm value={history} sex={female ? 'Cái' : 'Đực'} showReproduction={female} vaccines={vaccines.data ?? []}
        onError={setError} onChange={patch => { setHistory(current => ({ ...current, ...patch })); setError(null) }} />
      <Field label="Lý do" id="entry-demo-history-reason"><Textarea id="entry-demo-history-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></Field>
    </fieldset>
    {error && <Note tone="err">{error}</Note>}
    <ModalFooter><ModalButton onClick={onClose} disabled={busy}>Đóng</ModalButton><ModalButton variant="primary" disabled={busy} onClick={() => {
      const invalid = validateEntryHistory(history, female, record.date)
      if (invalid || !reason.trim()) { setError(invalid || 'Vui lòng nhập lý do.'); return }
      setBusy(true)
      void correctEntryHistoryDemo(record.id, String(line.code), history, reason).then(onSaved).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Không lưu được khai báo.')).finally(() => setBusy(false))
    }}>Lưu lịch sử</ModalButton></ModalFooter>
  </Modal>
}
