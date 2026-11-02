import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Info, Note } from '../../../components/ui'
import { platformServiceApi } from '../api/platformServiceApi'
import type { FarmOverview } from '../types'
import { fmtDate } from '../domain/dates'
import { shortFarmName, STATUS_LABEL, validateReason } from '../domain/servicePeriods'
import { ReasonField, ServiceBadge, useAction } from './common'

/** UC-FE02-05: tạm ngừng hoặc khôi phục dịch vụ một trại, bắt buộc có lý do. */
export default function ServiceChangeDialog({ farm, mode, onClose, onDone }: { farm: FarmOverview; mode: 'suspend' | 'restore'; onClose: () => void; onDone: (message: string) => void }) {
  const restore = mode === 'restore'
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { run, busy, error } = useAction()
  const hasPeriod = farm.coverageEnd !== null && (farm.periodEnd !== null || farm.serviceStatus === 'SUSPENDED')
  const afterRestore = farm.periodEnd || (farm.coverageEnd && farm.coverageEnd >= new Date().toISOString().slice(0, 10)) ? 'ACTIVE' : farm.coverageEnd ? 'EXPIRED' : 'PENDING_PAYMENT'

  async function submit() {
    const err = validateReason(reason, restore ? 'Lý do khôi phục' : 'Lý do tạm ngừng')
    setFieldError(err)
    if (err) return
    const cmd = { reason, version: farm.version }
    const res = await run(() => (restore ? platformServiceApi.restoreFarm(farm.farmId, cmd) : platformServiceApi.suspendFarm(farm.farmId, cmd)))
    if (res) onDone(`Dịch vụ của ${res.farmName} hiện ${STATUS_LABEL[res.serviceStatus].toLowerCase()}. Chủ trại đã được thông báo.`)
  }

  const items: Array<[string, string]> = []
  if (restore) items.push(['Tạm ngừng từ', `${fmtDate(farm.suspendedSince)} · bởi ${farm.suspendedBy ?? '—'}`], ['Lý do tạm ngừng', farm.suspendReason ?? '—'])
  items.push(['Kỳ dịch vụ đã mua', farm.coverageEnd && hasPeriod ? `${fmtDate(farm.periodStart)} → ${fmtDate(farm.coverageEnd)} (không đổi)` : 'Chưa có kỳ dịch vụ'])

  return (
    <Modal
      title={`${restore ? 'Khôi phục' : 'Tạm ngừng'} dịch vụ – ${farm.farmName}`}
      sub="Tạm ngừng và khôi phục tách biệt với thanh toán: thanh toán không tự gỡ tạm ngừng."
      topTitle="Dịch vụ trang trại"
      width={640}
      onClose={onClose}
    >
      <div className="flex items-center justify-between rounded-md bg-page px-4 py-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">{shortFarmName(farm.farmName) === farm.farmName ? farm.farmName : farm.farmName}</div>
          <div className="text-[12px] text-muted">Chủ trại {farm.ownerName} · {farm.herdSize} con</div>
        </div>
        <ServiceBadge status={farm.serviceStatus} />
      </div>
      <div className="mt-3">
        <Info cols={2} items={[...items, ...(restore ? ([['Sau khôi phục', STATUS_LABEL[afterRestore]]] as Array<[string, string]>) : [])]} />
      </div>
      <div className="mt-3">
        <ReasonField id="service-reason" label={`${restore ? 'Lý do khôi phục' : 'Lý do tạm ngừng'} *`} value={reason} onChange={setReason} error={fieldError} placeholder="Nhập lý do (tối đa 500 ký tự)" />
      </div>
      <Note tone={restore ? 'info' : 'warn'}>
        {restore
          ? `Khôi phục dịch vụ của ${farm.farmName}? Trạng thái sẽ theo gói đăng ký: ${STATUS_LABEL[afterRestore]}.`
          : `Tạm ngừng dịch vụ của ${farm.farmName}? Thành viên mất quyền vào vận hành trại; Chủ trại vẫn giữ gói đăng ký và hỗ trợ.`}
      </Note>
      <p className="mt-2 text-[12px] text-muted">PM không vào được dữ liệu vận hành của trại. Thao tác được ghi audit và thông báo cho Chủ trại.</p>
      {error ? <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p> : null}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={submit} disabled={busy}>
          <Icon name={restore ? 'refresh' : 'player-pause'} size={16} />
          {restore ? 'Khôi phục dịch vụ' : 'Tạm ngừng dịch vụ'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
