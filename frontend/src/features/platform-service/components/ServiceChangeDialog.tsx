import { useRef, useState } from 'react'
import { BackendError } from '../../../shared/api/backendClient'
import { userFacingError } from '../../../shared/api/userFacingError'
import { DISCARD_PROMPT, ErrorBlock, Icon, Info, LoadingBlock, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { useFarmServiceCommands, useFarmServicePreview } from '../hooks/usePlatformServiceUseCase'
import type { FarmOverview, FarmServicePreview, ServiceStatus } from '../types'
import { fmtDate } from '../domain/dates'
import { STATUS_LABEL } from '../domain/servicePeriods'
import { validateReason } from '../validation/servicePeriodValidation'
import { ReasonField, ServiceBadge, useAction } from './common'

/** E3, E4 and E1 of UC-FE02-05 in the PM's words; other failures as usual. */
function changeError(error: unknown, farmName: string) {
  if (error instanceof BackendError) {
    if (error.code === 'MSG-FE02-09') {
      const status = String(error.params.status ?? '') as ServiceStatus
      return `${farmName} đã ở trạng thái ${STATUS_LABEL[status] ?? status}.`
    }
    if (error.code === 'MSG-COM-05') return 'Dữ liệu trại vừa thay đổi ở phiên khác. Đóng hộp thoại, tải lại danh sách rồi thử lại.'
    if (error.code === 'MSG-COM-01') return 'Bạn không có quyền thực hiện thao tác này.'
  }
  return userFacingError(error, 'Không lưu được thay đổi. Vui lòng thử lại.')
}

function periodText(p: FarmServicePreview) {
  if (p.periodStart && p.periodEnd) return `${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)} (không đổi)`
  return p.coverageEnd ? `Đã hết ngày ${fmtDate(p.coverageEnd)} (không đổi)` : 'Chưa có kỳ dịch vụ'
}

/**
 * Popup "Tạm ngưng / Khôi phục dịch vụ" (UC-FE02-05): dữ liệu đọc lại từ máy chủ khi mở; lý do bắt buộc; cùng dữ liệu
 * thì giữ cùng khóa yêu cầu khi bấm lại (GBR-88).
 */
export default function ServiceChangeDialog({ farm, mode, onClose, onDone }: { farm: FarmOverview; mode: 'suspend' | 'restore'; onClose: () => void; onDone: (message: string) => void }) {
  const restore = mode === 'restore'
  const preview = useFarmServicePreview(farm.farmId)
  const { suspendFarm, restoreFarm } = useFarmServiceCommands()
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const keys = useRef(new Map<string, string>())
  const { run, busy, error } = useAction()
  // Table III-1: Hủy / ✕ after typing a reason asks first (MSG-COM-14).
  const close = () => { if (busy) return; if (reason.trim() && !discarding) setDiscarding(true); else onClose() }
  const p = preview.data
  const name = p?.farmName ?? farm.farmName

  async function submit() {
    if (!p) return
    const err = validateReason(reason, restore ? 'Lý do khôi phục' : 'Lý do tạm ngưng')
    setFieldError(err)
    if (err) return
    const cmd = { reason: reason.trim(), version: p.version }
    const signature = JSON.stringify([mode, farm.farmId, cmd])
    const key = keys.current.get(signature) ?? crypto.randomUUID()
    keys.current.set(signature, key)
    const res = await run(async () => {
      try {
        return await (restore ? restoreFarm(farm.farmId, cmd, { idempotencyKey: key }) : suspendFarm(farm.farmId, cmd, { idempotencyKey: key }))
      } catch (reasonError) {
        throw new Error(changeError(reasonError, name))
      }
    })
    // MSG-FE02-08
    if (res) onDone(`Dịch vụ của ${res.farmName} hiện là ${STATUS_LABEL[res.serviceStatus].toLowerCase()}. Đã thông báo cho Chủ trại.`)
  }

  const items: Array<[string, string]> = []
  if (p) {
    if (restore) items.push(['Tạm ngưng từ', `${fmtDate(p.suspendedSince)} · bởi ${p.suspendedBy ?? '—'}`], ['Lý do tạm ngưng', p.suspendReason ?? '—'])
    items.push(['Kỳ dịch vụ đã mua', periodText(p)])
    if (restore) items.push(['Sau khôi phục', STATUS_LABEL[p.statusAfterRestore]])
  }

  return (
    <Modal
      title={`${restore ? 'Khôi phục' : 'Tạm ngưng'} dịch vụ – ${farm.farmName}`}
      sub="Tạm ngưng và khôi phục tách biệt với thanh toán: thanh toán không tự gỡ tạm ngưng."
      topTitle="Dịch vụ trang trại"
      width={640}
      onClose={close}
    >
      {preview.loading && !p ? <LoadingBlock /> : null}
      {preview.error ? <ErrorBlock message={userFacingError(preview.error, 'Không tải được thông tin dịch vụ của trại.')} onRetry={preview.refetch} /> : null}
      {p ? (
        <>
          <div className="flex items-center justify-between rounded-md bg-page px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-ink">{p.farmName}</div>
              <div className="text-[12px] text-muted">Chủ trại {p.ownerName} · {p.herdSize} con</div>
            </div>
            <ServiceBadge status={p.serviceStatus} />
          </div>
          <div className="mt-3"><Info cols={2} items={items} /></div>
          <div className="mt-3">
            <ReasonField id="service-reason" label={`${restore ? 'Lý do khôi phục' : 'Lý do tạm ngưng'} *`} value={reason} onChange={(value) => { setReason(value); setDiscarding(false) }} error={fieldError} placeholder="Nhập lý do (tối đa 500 ký tự)" />
          </div>
          <Note tone={restore ? 'info' : 'warn'}>
            {restore
              ? `Khôi phục dịch vụ của ${p.farmName}? Trạng thái sẽ theo gói dịch vụ: ${STATUS_LABEL[p.statusAfterRestore]}.`
              : `Tạm ngưng dịch vụ của ${p.farmName}? Thành viên mất quyền thao tác trại; Chủ trại vẫn dùng được gói dịch vụ và hỗ trợ.`}
          </Note>
          <p className="mt-2 text-[12px] text-muted">PM không vào được dữ liệu vận hành của trại. Thao tác được ghi audit và thông báo cho Chủ trại.</p>
        </>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p> : null}
      {discarding ? <Note tone="warn">{DISCARD_PROMPT.question}</Note> : null}
      {/* No extra footer padding: the buttons line up with the content edge, as in the other dialogs of SCR-16. */}
      <ModalFooter className="!px-0 !pb-0">
        {discarding ? (
          <>
            <ModalButton onClick={() => setDiscarding(false)}>{DISCARD_PROMPT.keep}</ModalButton>
            <ModalButton variant="danger" onClick={onClose}>{DISCARD_PROMPT.discard}</ModalButton>
          </>
        ) : (
          <>
            <ModalButton onClick={close}>Hủy</ModalButton>
            {/* Suspending is the destructive choice (red, as on SCR-14 / SCR-16 / SCR-59); restoring stays primary. */}
            <ModalButton variant={restore ? 'primary' : 'danger'} onClick={submit} disabled={busy || !p}>
              <Icon name={restore ? 'refresh' : 'player-pause'} size={16} />
              {restore ? 'Khôi phục dịch vụ' : 'Tạm ngưng dịch vụ'}
            </ModalButton>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
