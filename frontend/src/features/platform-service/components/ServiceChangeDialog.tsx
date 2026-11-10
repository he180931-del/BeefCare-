import { useRef, useState } from 'react'
import { BackendError } from '../../../api/backendClient'
import { userFacingError } from '../../../api/userFacingError'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { ErrorBlock, Info, LoadingBlock, Note } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { platformServiceApi } from '../api/platformServiceApi'
import type { FarmOverview, FarmServicePreview, ServiceStatus } from '../types'
import { fmtDate } from '../domain/dates'
import { STATUS_LABEL, validateReason } from '../domain/servicePeriods'
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
  const preview = useQuery(() => platformServiceApi.getFarmService(farm.farmId), [farm.farmId])
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())
  const { run, busy, error } = useAction()
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
        return await (restore ? platformServiceApi.restoreFarm(farm.farmId, cmd, { idempotencyKey: key }) : platformServiceApi.suspendFarm(farm.farmId, cmd, { idempotencyKey: key }))
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
      onClose={onClose}
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
            <ReasonField id="service-reason" label={`${restore ? 'Lý do khôi phục' : 'Lý do tạm ngưng'} *`} value={reason} onChange={setReason} error={fieldError} placeholder="Nhập lý do (tối đa 500 ký tự)" />
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
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={submit} disabled={busy || !p}>
          <Icon name={restore ? 'refresh' : 'player-pause'} size={16} />
          {restore ? 'Khôi phục dịch vụ' : 'Tạm ngưng dịch vụ'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
