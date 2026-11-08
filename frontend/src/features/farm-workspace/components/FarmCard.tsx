import { Icon, type IconName } from '../../../components/Icon'
import { Badge } from '../../../components/ui'
import type { FarmSummary } from '../types'
import { formatDate, roleLabel, serviceLabel } from './WorkspaceUi'

const tone = (status: string) => status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'err' : 'warn'
const place = (farm: FarmSummary) => [farm.commune?.replace(/^(Xã|Phường|Thị trấn) /, ''), farm.province].filter(Boolean).join(', ')

/** Nhãn, biểu tượng và đích của nút trên thẻ trại (SCR-09, MSG-FE02-03/04). */
export function farmAction(farm: FarmSummary): { label: string; icon: IconName; primary: boolean; disabled: boolean; to: string | null } {
  const owner = farm.role === 'OWNER'
  if (farm.serviceStatus === 'ACTIVE') return { label: 'Vào trại', icon: 'logout', primary: true, disabled: false, to: farm.role === 'TECHNICIAN' ? '/kt' : '/tong-quan' }
  if (!owner) return { label: 'Chủ trại quản lý gói dịch vụ', icon: 'lock', primary: false, disabled: true, to: null }
  if (farm.serviceStatus === 'PENDING_PAYMENT') return { label: 'Thanh toán để kích hoạt', icon: 'credit-card', primary: false, disabled: false, to: '/goi-dich-vu' }
  if (farm.serviceStatus === 'EXPIRED') return { label: 'Gia hạn dịch vụ', icon: 'refresh', primary: false, disabled: false, to: '/goi-dich-vu' }
  return { label: 'Gửi Ticket', icon: 'send', primary: false, disabled: false, to: '/ho-tro' }
}

function serviceText(farm: FarmSummary) {
  if (farm.serviceStatus === 'ACTIVE') return farm.role === 'OWNER' ? (farm.serviceUntil ? `Đến ${formatDate(farm.serviceUntil)}` : 'Đang hoạt động') : 'Gói do chủ trại quản lý'
  if (farm.serviceStatus === 'PENDING_PAYMENT') return 'Chưa có kỳ dịch vụ'
  if (farm.serviceStatus === 'EXPIRED') return 'Đã hết hạn'
  return 'Tạm ngưng'
}

export function FarmCard({ farm, onOpen }: { farm: FarmSummary; onOpen: (farm: FarmSummary, to: string) => void }) {
  const action = farmAction(farm)
  const fact = (label: string, value: string) => <div><span className="block text-[11px] text-subtle">{label}</span><strong className="text-[13px] font-medium text-ink">{value}</strong></div>
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-field bg-white p-5">
      <div>
        <h2 className="m-0 text-sm font-semibold text-ink">{farm.name}</h2>
        <p className="m-0 mt-1 text-xs text-subtle">{place(farm)}</p>
        <div className="mt-2"><Badge tone={tone(farm.serviceStatus)}>{serviceLabel(farm.serviceStatus)}</Badge></div>
      </div>
      <div className="flex flex-col gap-2">
        {fact('Vai trò của bạn', roleLabel(farm.role))}
        {fact('Quy mô', farm.activeCattleCount == null ? 'Chưa có dữ liệu từ máy chủ' : `${farm.activeCattleCount} con`)}
        {fact('Dịch vụ', serviceText(farm))}
      </div>
      {action.disabled && <p className="m-0 text-[11px] text-subtle">{farm.name} chưa khả dụng vì dịch vụ {serviceLabel(farm.serviceStatus).toLowerCase()}. Vui lòng liên hệ Chủ trại.</p>}
      <button
        type="button" disabled={action.disabled} onClick={() => action.to && onOpen(farm, `${action.to}?farmId=${farm.id}`)}
        className={`inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.primary ? 'border-brand bg-brand text-white' : 'border-field bg-white text-ink'}`}
      ><Icon name={action.icon} size={16} />{action.label}</button>
    </article>
  )
}
