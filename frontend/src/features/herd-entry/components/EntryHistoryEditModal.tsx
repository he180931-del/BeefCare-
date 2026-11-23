import { useState } from 'react'
import { Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import EntryHistoryDeclarationForm from './EntryHistoryDeclarationForm'
import { validateEntryHistory, type EntryHistory } from '../domain/entryHistory'
import type { EntryVaccineOption } from '../api/herdEntryBackendApi'

export default function EntryHistoryEditModal({ initial, female, date, vaccines, onApply, onClose }: {
  initial: EntryHistory; female: boolean; date: string; vaccines: EntryVaccineOption[];
  onApply: (history: EntryHistory) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial))
  const [error, setError] = useState<string | null>(null)
  return <Modal width={720} title="Khai báo lịch sử trước nhập" onClose={onClose}>
    <EntryHistoryDeclarationForm value={draft} sex={female ? 'Cái' : 'Đực'} showReproduction={female} vaccines={vaccines}
      onError={setError} onChange={patch => { setDraft(current => ({ ...current, ...patch })); setError(null) }} />
    {!female && <Note>Khai báo sinh sản sẽ bị bỏ vì bò là đực.</Note>}
    {error && <Note tone="err">{error}</Note>}
    <ModalFooter><ModalButton onClick={onClose}>Hủy</ModalButton><ModalButton variant="primary" onClick={() => {
      const invalid = validateEntryHistory(draft, female, date)
      if (invalid) { setError(invalid); return }
      onApply(draft)
    }}>Áp dụng lịch sử</ModalButton></ModalFooter>
  </Modal>
}
