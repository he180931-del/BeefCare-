import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../../../components/Icon'
import { backendMode } from '../../../api/backendTransport'
import Modal, { useModalParam } from '../../../components/Modal'
import { Badge, Button, Note } from '../../../components/ui'
import { DIALOG_FIXTURES } from '../data/subscriptionMock'
import { fmtDate, fmtDateTime, fmtEndDay, paymentQuote, quoteText, termLabel } from '../domain/subscriptionRules'
import type { StateDialogState } from '../types'
import { Facts, ICON_BTN, PaymentBadge, useIsPhone, type Fact } from './shared'
import { useFarmScope } from './useFarmScope'

interface Action { label: string; icon?: IconName; primary?: boolean; onClick: () => void }
interface Built { title: string; sub?: ReactNode; facts?: Fact[]; text?: string; actions: Action[] }

interface Handlers {
  close: () => void
  history: () => void
  newRequest: () => void
  reopen: (code: string) => void
  support: () => void
  reload: () => void
}

function build(state: StateDialogState, h: Handlers): Built {
  const historyBtn: Action = { label: 'Lịch sử thanh toán', icon: 'history', onClick: h.history }
  switch (state.kind) {
    case 'expired':
      return {
        title: 'Yêu cầu đã hết hạn', sub: state.payment.quoteRef,
        facts: [['Trạng thái', <Badge key="s" tone="err">Đã hết hạn</Badge>], ['Thời hạn / giá', paymentQuote(state.payment)], ['Tạo lúc', fmtDateTime(state.payment.requestedAt)], ['Hết hạn', fmtDateTime(state.payment.expiresAt)]],
        actions: [{ label: 'Về lịch sử', icon: 'arrow-left', onClick: h.history }, { label: 'Tạo yêu cầu mới', icon: 'circle-plus', primary: true, onClick: h.newRequest }],
      }
    case 'pending-exists':
      return {
        title: 'Bạn đã có yêu cầu còn hiệu lực', sub: state.payment.quoteRef,
        facts: [['Trạng thái', <Badge key="s" tone="warn">Đang chờ</Badge>], ['Giá / thời hạn', paymentQuote(state.payment)], ['Hết hạn', fmtDateTime(state.payment.expiresAt)]],
        actions: [{ label: 'Quay lại', icon: 'arrow-left', onClick: h.close }, { label: 'Mở lại hướng dẫn', primary: true, onClick: () => h.reopen(backendMode === 'backend' ? String(state.payment.id) : state.payment.quoteRef) }],
      }
    case 'renewal-closed':
      return {
        title: 'Chưa đến thời gian gia hạn',
        facts: [['Đã xác nhận đến', state.confirmedEnd ? fmtEndDay(state.confirmedEnd) : '—'], ['Được tạo yêu cầu mới từ', fmtDate(state.opensAt)]],
        actions: [historyBtn],
      }
    case 'suspended':
      return {
        title: 'Trại đang tạm ngưng dịch vụ', sub: state.farmName,
        facts: [['Dịch vụ', <Badge key="s" tone="warn">Tạm ngưng</Badge>], ['Kỳ đã mua đến', state.paidUntil ? fmtEndDay(state.paidUntil) : '—']],
        actions: [historyBtn, { label: 'Gửi hỗ trợ', icon: 'send', primary: true, onClick: h.support }],
      }
    case 'price-changed':
      return {
        title: 'Bảng giá đã thay đổi',
        facts: [['Giá đã xem', quoteText(state.seen.version, state.seen.term, state.seen.amountVnd)], ['Giá hiện tại', quoteText(state.current.version, state.current.term, state.current.amountVnd)]],
        actions: [{ label: 'Quay lại', icon: 'arrow-left', onClick: h.close }, { label: 'Xem lại giá mới', primary: true, onClick: h.reload }],
      }
    case 'price-unavailable':
      return {
        title: 'Giá gói chưa khả dụng', text: 'Chưa lấy được bảng giá hoặc thông tin tài khoản nhận.',
        actions: [historyBtn, { label: 'Thử lại', icon: 'refresh', primary: true, onClick: h.reload }],
      }
    case 'result-unavailable':
      return {
        title: 'Chưa lấy được kết quả thanh toán', sub: `${state.payment.quoteRef} · ${termLabel(state.payment.durationYears)}`,
        facts: [['Trạng thái gần nhất', <PaymentBadge key="s" state={state.payment.state} />], ['Kiểm tra lúc', state.checkedAt ? fmtDateTime(state.checkedAt) : '—']],
        actions: [{ label: 'Về lịch sử', icon: 'arrow-left', onClick: h.history }, { label: 'Thử lại', icon: 'refresh', primary: true, onClick: h.reload }],
      }
  }
}

/** Màn hình điện thoại: kết quả thanh toán không lấy được hiện thành bottom sheet (frame 2637:18409). */
function PhoneSheet({ onClose, onRetry }: { onClose: () => void; onRetry: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(23,37,30,0.32)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Chưa cập nhật được thanh toán" className="w-full rounded-t-2xl bg-white p-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-bold text-ink">Chưa cập nhật được thanh toán</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="text-subtle"><Icon name="x" size={18} /></button>
        </div>
        <div className="mt-3">
          <Note tone="info">Chưa lấy được trạng thái mới. Yêu cầu cũ được giữ nguyên; thử lại cùng mã, không tạo yêu cầu khác.</Note>
        </div>
        <Button variant="primary" size="lg" block className={`mt-3 ${ICON_BTN}`} onClick={onRetry}><Icon name="refresh" size={16} /> Thử lại</Button>
      </div>
    </div>
  )
}

export function StateDialog({ state, handlers, phone }: { state: StateDialogState; handlers: Handlers; phone: boolean }) {
  if (phone && state.kind === 'result-unavailable') return <PhoneSheet onClose={handlers.close} onRetry={handlers.reload} />
  const b = build(state, handlers)
  return (
    <Modal title={b.title} sub={b.sub} width={560} onClose={handlers.close}>
      {b.facts && <Facts items={b.facts} cols={2} />}
      {b.text && <p className="m-0 text-[13px] text-ink">{b.text}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        {b.actions.map((a) => (
          <Button key={a.label} size="lg" variant={a.primary ? 'primary' : 'default'} className={ICON_BTN} onClick={a.onClick}>
            {a.icon && <Icon name={a.icon} size={16} />}
            {a.label}
          </Button>
        ))}
      </div>
    </Modal>
  )
}

interface Options {
  /** Chạy lại thao tác đang bị chặn: tải lại bảng giá, kiểm tra lại thanh toán... */
  onReload?: () => void
  /** Trạng thái thật đang chặn trang (vd. trại tạm ngưng): hộp thoại luôn hiện cho đến khi người dùng rời đi. */
  forced?: StateDialogState | null
  onDismiss?: () => void
}

/**
 * Các hộp thoại trạng thái của luồng thanh toán. Nguồn dữ liệu, theo thứ tự: `show()` từ lỗi thật của API,
 * `forced` từ điều kiện thật của trang, rồi `?m=<tên>` (dữ liệu mẫu của frame) để mở trực tiếp.
 */
export function useStateDialog({ onReload, forced, onDismiss }: Options = {}) {
  const [m, , closeModal] = useModalParam()
  const [shown, setShown] = useState<StateDialogState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  const phone = useIsPhone()
  const { to } = useFarmScope()
  const active = shown ?? (dismissed ? null : forced) ?? (m ? DIALOG_FIXTURES[m] ?? null : null)

  const go = (path: string, extra?: Record<string, string>) => { setShown(null); navigate(to(path, extra)) }
  const close = () => {
    setShown(null)
    setDismissed(true)
    if (onDismiss) onDismiss()
    else if (m) closeModal()
  }
  const handlers: Handlers = {
    close,
    history: () => go('/goi-dich-vu/lich-su'),
    newRequest: () => go('/goi-dich-vu/gia-han'),
    reopen: (code) => go(`/goi-dich-vu/chuyen-khoan/${code}`, { from: 'subscription' }),
    support: () => go('/ho-tro'),
    reload: () => { close(); setDismissed(false); onReload?.() },
  }
  return { show: setShown, element: active ? <StateDialog state={active} handlers={handlers} phone={phone} /> : null }
}
