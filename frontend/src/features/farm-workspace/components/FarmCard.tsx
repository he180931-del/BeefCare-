import { Icon, type IconName } from '../../../components/Icon'
import { Badge } from '../../../components/ui'
import type { FarmServiceStatus, FarmSummary } from '../types'
import { lastServiceDay, roleLabel, serviceLabel } from './WorkspaceUi'

const tone = (status: string) => status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'err' : 'warn'
const place = (farm: FarmSummary) => [farm.commune?.replace(/^(Xã|Phường|Thị trấn) /, ''), farm.province].filter(Boolean).join(', ')

export interface FarmCardAction { label: string; icon: IconName; primary: boolean; disabled: boolean; to: string | null }

/**
 * SCR-09 card action by role and service status. `to` already names the farm, because the page reloads into it.
 * PENDING_PAYMENT and EXPIRED open plan selection SCR-58 (decision 08/11/2026, FE-02 Q5); `from=chon-trai` asks it to
 * show MSG-FE02-03. A Manager or Technician of a farm that is not ACTIVE gets a locked card (AF3, MSG-FE02-04).
 */
export function farmAction(farm: FarmSummary): FarmCardAction {
  if (farm.serviceStatus === 'ACTIVE') return { label: 'Vào trại', icon: 'logout', primary: true, disabled: false, to: farm.role === 'TECHNICIAN' ? '/kt' : '/tong-quan' }
  if (farm.role !== 'OWNER') return { label: 'Chủ trại quản lý gói dịch vụ', icon: 'lock', primary: false, disabled: true, to: null }
  if (farm.serviceStatus === 'PENDING_PAYMENT') return { label: 'Thanh toán để kích hoạt', icon: 'credit-card', primary: false, disabled: false, to: `/dang-ky-goi?farm=${farm.id}&from=chon-trai` }
  if (farm.serviceStatus === 'EXPIRED') return { label: 'Gia hạn', icon: 'refresh', primary: false, disabled: false, to: `/goi-dich-vu/gia-han?farm=${farm.id}&from=chon-trai` }
  return { label: 'Gửi phiếu hỗ trợ', icon: 'send', primary: false, disabled: false, to: `/ho-tro/moi?category=FARM_SERVICE&farmId=${farm.id}` }
}

/** MSG-FE02-04 (SCR-09 locked card). */
export const unavailableFarmMessage = (farm: string, status: FarmServiceStatus | string) =>
  `${farm} không khả dụng vì dịch vụ đang ở trạng thái ${serviceLabel(status)}. Vui lòng liên hệ Chủ trại.`

/** SCR-09 field 7, the same for every role: "Đến dd/mm/yyyy", "Chưa có kỳ dịch vụ" or "Đang tạm ngưng". */
function serviceText(farm: FarmSummary) {
  if (farm.serviceStatus === 'SUSPENDED') return 'Đang tạm ngưng'
  return farm.serviceStatus !== 'PENDING_PAYMENT' && farm.serviceUntil ? `Đến ${lastServiceDay(farm.serviceUntil)}` : 'Chưa có kỳ dịch vụ'
}

export function FarmCard({ farm, busy = false, onOpen }: { farm: FarmSummary; busy?: boolean; onOpen: (farm: FarmSummary) => void }) {
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
      {action.disabled && <p className="m-0 text-[11px] text-subtle">{unavailableFarmMessage(farm.name, farm.serviceStatus)}</p>}
      <button
        type="button" disabled={action.disabled || busy} onClick={() => onOpen(farm)}
        className={`inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.primary ? 'border-brand bg-brand text-white' : 'border-field bg-white text-ink'}`}
      ><Icon name={action.icon} size={16} />{action.label}</button>
    </article>
  )
}
