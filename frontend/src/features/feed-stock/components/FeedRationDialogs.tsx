import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { DateInput, Field, Note } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { cancelFeedRationVersion, stopFeedRation } from '../api/feedRationApi'
import { localRationDate } from '../data/feedRationForm'
import { formatDate } from '../domain/feedLabels'
import type { FeedRation } from '../types/feedRation'

/** UC-FE23-06 AF1: cancel a version that has not taken effect yet; the previous version stays effective. */
export function FeedRationCancelDialog({ row, onClose, onDone }: { row: FeedRation; onClose: () => void; onDone: (message: string) => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await cancelFeedRationVersion(row.id)
      onDone(`Đã hủy phiên bản ${row.rationCode} v${row.versionNo}. Phiên bản trước tiếp tục có hiệu lực.`)
    } catch (cancelError) {
      setError(userFacingError(cancelError, 'Không thể hủy phiên bản. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title={`Hủy phiên bản ${row.rationCode} v${row.versionNo}`} sub={`Dự kiến áp dụng từ ${formatDate(row.effectiveFrom)}`} width={560} onClose={onClose}>
      <Note tone="info">Phiên bản chưa có hiệu lực sẽ bị bỏ. Phiên bản trước của khẩu phần này vẫn tiếp tục áp dụng cho chuồng, nhật ký cho ăn đã ghi không đổi.</Note>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Giữ phiên bản</ModalButton>
        <ModalButton variant="danger" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang hủy…' : 'Hủy phiên bản'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** UC-FE23-06 AF2: stop an effective ration from a date tomorrow or later; its pens have no ration after it. */
export function FeedRationStopDialog({ row, onClose, onDone }: { row: FeedRation; onClose: () => void; onDone: (message: string) => void }) {
  const [endDate, setEndDate] = useState(localRationDate(1))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (endDate < localRationDate(1)) { setError('Ngày kết thúc phải từ ngày mai trở đi.'); return }
    setSaving(true)
    setError('')
    try {
      await stopFeedRation(row.id, endDate)
      onDone(`${row.rationCode} v${row.versionNo} sẽ ngừng áp dụng sau ngày ${formatDate(endDate)}.`)
    } catch (stopError) {
      setError(userFacingError(stopError, 'Không thể ngừng khẩu phần. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title={`Ngừng khẩu phần ${row.rationCode} v${row.versionNo}`} sub={`Đang áp dụng từ ${formatDate(row.effectiveFrom)}`} width={560} onClose={onClose}>
      <Field label="Ngày kết thúc *" id="feed-ration-stop-date" hint="Từ ngày mai trở đi. Các chuồng áp dụng sẽ không còn khẩu phần sau ngày này.">
        <DateInput id="feed-ration-stop-date" value={endDate} onChange={(value) => { setEndDate(value); setError('') }} />
      </Field>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Ngừng khẩu phần'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
