import { useState } from 'react'
import { Modal, ModalButton, ModalFooter, NoticeDialog } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDateTime, fmtDec, fmtKg } from '../domain/growthFormat'
import { METHOD_LABEL } from '../domain/growthLabels'
import { useGrowthCommands } from '../hooks/useGrowthUseCase'
import type { GrowthRecord } from '../types'

/** Mô tả ngắn một lần đo để người dùng chắc đang xóa đúng dòng: "13/10/2026 07:00 · 330 kg · BCS 3 · Cân điện tử". */
export function recordSummary(record: GrowthRecord): string {
  return [
    fmtDateTime(record.measuredAt),
    record.weightKg !== undefined && `${fmtKg(record.weightKg)} kg`,
    record.bcs !== undefined && `BCS ${fmtDec(record.bcs)}`,
    record.method && METHOD_LABEL[record.method],
  ].filter(Boolean).join(' · ')
}

/**
 * Xác nhận xóa một lần đo. Phía máy chủ là loại trừ mềm (EXCLUDE): lần đo không còn được tính, không hiện trong
 * lịch sử đo, nhưng dữ liệu gốc và người xóa vẫn được lưu (D43, BR-D15).
 */
export default function GrowthDeleteModal({ record, onClose, onDeleted }: { record: GrowthRecord; onClose: () => void; onDeleted: (message: string) => void }) {
  const { correct } = useGrowthCommands()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await correct(record.cattleCode, record.id, { action: 'EXCLUDE', expectedVersion: record.version })
      onDeleted(`Đã xóa lần đo ${fmtDateTime(record.measuredAt)}.`)
    } catch (e) {
      setError(userFacingError(e, 'Không xóa được lần đo. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Xóa lần đo?" sub={`${record.cattleCode} · ${recordSummary(record)}`} width={480} onClose={onClose}>
      <p className="m-0 text-sm">Lần đo này sẽ không còn được tính vào cân hiện tại, ADG và dự kiến xuất bán, và không hiện trong lịch sử đo.</p>
      {error && <NoticeDialog message={error} onClose={() => setError(null)} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="danger" disabled={busy} onClick={() => void remove()}>Xóa</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
