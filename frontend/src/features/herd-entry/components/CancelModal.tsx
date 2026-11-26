import { Badge, Button, Field, Icon, Modal, ModalButton, ModalFooter, Note, Table, Td, Textarea, Th } from '../../../shared/ui'
import { useState } from 'react'
import { dmy, money } from '../../../shared/lib/format'
import type { EntryVoucherVoidCheck, HerdEntry } from '../types'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { entryEventLabel } from '../domain/entryEventLabel'
import { isFarmBornEntry } from '../domain/entryLineCorrection'
import { herdEntryError } from '../api/herdEntryError'
import { useEntryVoucherVoidCheck } from '../hooks/useEntryVoucherVoidCheck'

const TH = 'px-1! first:pl-3! last:pr-3!'
const REASON_MAX = 500

/** MSG-FE06-21: the backend message names the blocked cattle; the spec text is the fallback. */
export const voidBlockedMessage = (code: string, check: EntryVoucherVoidCheck) => check.blocked?.message
  || `Không thể hủy phiếu ${code}: ${check.rows.filter(row => !row.canVoid).map(row => row.cattleCode).join(', ')} đã có sự kiện khác. Hãy sửa hoặc hủy từng bản ghi.`

/** MSG-FE06-20, built from the check so the paid amount is formatted (the backend message carries the raw number). */
export const voidConfirmMessage = (code: string, check: EntryVoucherVoidCheck) =>
  `Hủy phiếu ${code}? ${check.rows.length} hồ sơ bò sẽ bị hủy, trả chỗ chuồng và thu hồi thẻ QR. Khoản đã trả ${money(check.paid)} đ vẫn nằm trong lịch sử.`

/**
 * Popup "Hủy phiếu nhập" (UC-FE06-05, R-06-15). The per-cattle result comes from
 * GET …/void-check; the button stays locked while any cattle is blocked, and the
 * void is only sent after the MSG-FE06-20 confirmation step.
 */
export default function CancelModal({ record, onConfirm, onClose, error, saving, onReload }: { record: HerdEntry; onConfirm: (reason: string) => void | Promise<void>; onClose: () => void; error?: unknown; saving?: boolean; onReload?: () => Promise<unknown> }) {
  const check = useEntryVoucherVoidCheck(record)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const result = check.data
  const rows = result?.rows ?? []
  const farmBorn = isFarmBornEntry(record)
  const sourceName = farmBorn ? 'Bê sinh tại trại' : record.detail?.sourceName || record.source || '—'
  const pens = [...new Set((record.detail?.cows ?? []).filter(cow => cow.lineStatus !== 'VOID').map(cow => (cow.barn ?? '').split(' ')[0]).filter(Boolean))]
  const codes = rows.map(row => row.cattleCode).filter(Boolean).join(', ')
  const blocked = Boolean(result && !result.canVoid)

  const requestVoid = () => {
    if (!reason.trim()) { setReasonError('Lý do hủy là bắt buộc.'); return }
    setConfirming(true)
  }

  return (
    <Modal
      width={640}
      title={`Hủy phiếu nhập ${record.id}`}
      sub={`${record.type ?? ''} · ${dmy(record.date)} · ${record.count ?? rows.length} con · ${sourceName}`}
      topTitle="Hủy phiếu nhập"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Kiểm tra trước khi hủy</h3>
        {check.loading && <p className="m-0 text-xs text-muted">Đang kiểm tra các bò của phiếu…</p>}
        {Boolean(check.error) && (
          <Note tone="err">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">{herdEntryError(check.error, 'Không thể kiểm tra phiếu trước khi hủy. Vui lòng thử lại.')}</span>
              <Button small onClick={() => { void check.refetch() }}>Thử lại</Button>
            </div>
          </Note>
        )}
        {result && (
          <Table variant="panel" stack={false}>
            <thead>
              <tr>
                <Th className={`${TH} w-[170px]`}>Bò</Th>
                <Th className={`${TH} w-[260px]`}>Sự kiện sau nhập đàn</Th>
                <Th className={TH}>Kết quả</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entryId ?? row.cattleCode}>
                  <Td className={TH}>{row.cattleCode || '—'}</Td>
                  <Td className={TH}>{row.eventsAfterEntry.length ? row.eventsAfterEntry.map(entryEventLabel).join(', ') : 'Không có (chỉ nhập đàn và xếp chuồng)'}</Td>
                  <Td className={TH}>{row.canVoid ? <Badge tone="ok" icon="circle-check">Hủy được</Badge> : <Badge tone="err" icon="circle-x">Bị chặn</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {result && blocked && <Note tone="err">{voidBlockedMessage(record.id, result)}</Note>}
      </div>

      {result && !blocked && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">Khi xác nhận hủy</h3>
          <Note tone="ok">
            <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Hồ sơ {codes} chuyển ĐÃ HỦY; mã bò không được dùng lại.</div>
            <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Đóng phân chuồng{pens.length ? ` ${pens.join(', ')}` : ''}, giải phóng {rows.length} chỗ; thẻ QR bị thu hồi.</div>
            {farmBorn && <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Bê quay về danh sách chờ xác nhận.</div>}
          </Note>
          {result.paid > 0 && <Note tone="warn"><div className="flex items-start gap-1.5"><Icon name="alert-triangle" size={14} className="mt-px shrink-0" />Khoản đã thanh toán {money(result.paid)} đ vẫn giữ trong lịch sử – việc đòi lại tiền xử lý ngoài hệ thống.</div></Note>}
        </div>
      )}

      <Field
        label="Lý do hủy *"
        id="entry-void-reason"
        hint={reasonError ? <span className="text-err-fg">{reasonError}</span> : `${reason.length}/${REASON_MAX} ký tự`}
      >
        <Textarea
          id="entry-void-reason"
          rows={2}
          maxLength={REASON_MAX}
          value={reason}
          aria-invalid={reasonError ? 'true' : undefined}
          disabled={saving || confirming}
          onChange={(e) => { setReason(e.target.value); setReasonError('') }}
        />
      </Field>

      {confirming && result && <Note tone="warn">{voidConfirmMessage(record.id, result)}</Note>}

      {onReload && <VoucherCommandError error={error} onReload={onReload} />}
      <ModalFooter>
        {confirming ? (
          <>
            <ModalButton disabled={saving} onClick={() => setConfirming(false)}>Quay lại</ModalButton>
            <ModalButton variant="danger" disabled={saving} onClick={() => { void Promise.resolve(onConfirm(reason.trim())).catch(() => undefined) }}>
              <Icon name="circle-x" />{saving ? 'Đang hủy…' : 'Xác nhận hủy'}
            </ModalButton>
          </>
        ) : (
          <>
            <ModalButton onClick={onClose}>Đóng</ModalButton>
            <ModalButton variant="danger" disabled={!result || blocked || saving} onClick={requestVoid}>
              <Icon name="circle-x" />Hủy phiếu nhập
            </ModalButton>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
