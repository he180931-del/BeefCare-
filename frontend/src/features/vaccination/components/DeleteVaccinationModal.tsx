import { useState } from 'react'
import { Modal, ModalButton, ModalFooter, NoticeDialog } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDateTime, fmtMonthYear } from '../domain/vaccinationFormat'
import { useVaccinationCommands } from '../hooks/useVaccinationUseCase'
import type { VaccinationRecord } from '../types'

/** Mô tả ngắn một mũi tiêm để người dùng chắc đang xóa đúng dòng: "25/09/2026 08:00 · Tụ huyết trùng mũi 1 · 2 ml". */
export function vaccinationSummary(record: VaccinationRecord): string {
  return [
    record.precision === 'MONTH' ? fmtMonthYear(record.administeredAt) : fmtDateTime(record.administeredAt),
    [record.vaccineLabel, record.doseText].filter(Boolean).join(' '),
    record.dose,
  ].filter(Boolean).join(' · ')
}

/**
 * Xác nhận xóa một bản ghi tiêm (D53, như FE-08 D43). Phía máy chủ là xóa mềm (VOIDED): bản ghi không còn trong lịch
 * sử tiêm, mũi theo lịch quay lại chưa tiêm; dữ liệu gốc và người xóa vẫn được lưu (BR-D15).
 */
export default function DeleteVaccinationModal({ record, onClose, onDeleted }: { record: VaccinationRecord; onClose: () => void; onDeleted: (message: string) => void }) {
  const { voidRecord } = useVaccinationCommands()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await voidRecord(record.id, { expectedVersion: record.version })
      onDeleted('Đã xóa bản ghi tiêm.')
    } catch (e) {
      setError(userFacingError(e, 'Không xóa được bản ghi tiêm. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Xóa mũi tiêm?" sub={`${record.cattleCode} · ${vaccinationSummary(record)}`} width={480} onClose={onClose}>
      <p className="m-0 text-sm">Mũi tiêm này sẽ không còn trong lịch sử tiêm{record.scheduledDoseId ? ' và mũi theo lịch quay lại chưa tiêm' : ''}.</p>
      {error && <NoticeDialog message={error} onClose={() => setError(null)} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="danger" disabled={busy} onClick={() => void remove()}>Xóa</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
