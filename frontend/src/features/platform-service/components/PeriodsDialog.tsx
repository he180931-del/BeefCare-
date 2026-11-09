import { Link } from 'react-router-dom'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Note } from '../../../components/ui'
import type { SubscriptionDetail } from '../types'
import { fmtDate, fmtDateTime, fmtEndDate } from '../domain/dates'
import { shortFarmName, STATUS_LABEL } from '../domain/servicePeriods'
import { ReadField } from './common'

const range = (p: { start: string; end: string; termYears: number }) => `${fmtDate(p.start)} – ${fmtEndDate(p.end)} · ${p.termYears} năm`
const payment = (p?: { paymentCode: string; confirmedAt: string | null }) => (p ? `${p.paymentCode} · ${fmtDateTime(p.confirmedAt)}` : '—')

/** Các kỳ đã mua của một trại: kỳ hiện tại, kỳ tương lai và thanh toán nguồn (chỉ xem). */
export default function PeriodsDialog({ detail, onClose }: { detail: SubscriptionDetail; onClose: () => void }) {
  const s = detail.summary
  const current = detail.periods.find((p) => p.state === 'CURRENT')
  const future = detail.periods.find((p) => p.state === 'FUTURE')
  const access = `${current ? 'Có kỳ hiện tại' : 'Chưa có kỳ hiện tại'} · ${STATUS_LABEL[s.serviceStatus]} · ${detail.suspended ? 'Đang tạm ngưng' : 'Không tạm ngưng'}`
  const link = future ?? current
  return (
    <Modal title={`Các kỳ đã mua của ${shortFarmName(s.farmName)}`} topTitle="Gói đăng ký" width={640} onClose={onClose}>
      <div className="grid gap-3">
        <ReadField id="pd-access" label="Quyền hiện tại / dịch vụ" value={access} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadField id="pd-current" label="Kỳ hiện tại" value={current ? range(current) : '—'} />
          <ReadField id="pd-current-pay" label="Thanh toán hiện tại / xác nhận" value={payment(current)} />
          <ReadField id="pd-future" label="Kỳ tương lai" value={future ? range(future) : '—'} />
          <ReadField id="pd-future-pay" label="Thanh toán tương lai / xác nhận" value={payment(future)} />
        </div>
        <ReadField id="pd-until" label="Đã xác nhận đến / mở gia hạn" value={`${fmtEndDate(s.confirmedUntil)} · ${fmtDate(detail.renewalOpens)}`} />
      </div>
      <Note tone="info">Kỳ tương lai không thay kỳ hiện tại. Thời điểm và khoảng đã mua không được sửa.</Note>
      <ModalFooter>
        <ModalButton onClick={onClose}><Icon name="arrow-left" size={16} />Quay lại</ModalButton>
        {link ? (
          <Link to={link.paymentId ? `/nen-tang/thanh-toan?paymentId=${link.paymentId}&farmId=${s.farmId}` : '/nen-tang/thanh-toan'} className="inline-flex h-[44px] items-center gap-2 rounded-xl bg-brand px-4 text-[14px] font-semibold text-white">
            <Icon name="credit-card" size={16} />Thanh toán {link.paymentCode}
          </Link>
        ) : null}
      </ModalFooter>
    </Modal>
  )
}
