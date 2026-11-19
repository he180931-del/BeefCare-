import { useEffect, useRef, type ReactNode } from 'react'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Icon, Note } from '../../../shared/ui'
import { useSession } from '../../authorization'
import { MSG, PlatformAdminError, initials } from '../domain/platformRules'
import type { AccountStatus } from '../types'

export const errorMessage = (error: unknown, fallback = 'Không thể lưu dữ liệu. Vui lòng thử lại.') =>
  error instanceof PlatformAdminError ? error.message : userFacingError(error, fallback)

export function Avatar({ name, system }: { name: string; system?: boolean }) {
  return (
    <span aria-hidden className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#eef4ef] text-[9px] font-semibold text-brand">
      {system ? <Icon name="user-cog" size={12} /> : initials(name)}
    </span>
  )
}

export const ICON_BUTTON = 'inline-flex items-center justify-center gap-2'

export function PersonCell({ name, sub, system, wrap }: { name: string; sub?: string; system?: boolean; wrap?: boolean }) {
  const clip = wrap ? 'break-words' : 'truncate'
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar name={name} system={system} />
      <div className="min-w-0 text-left">
        <div className={`${clip} text-xs font-medium text-ink`}>{name}</div>
        {sub && <div className={`${clip} text-[11px] text-muted`}>{sub}</div>}
      </div>
    </div>
  )
}

export const AccountStatusBadge = ({ status }: { status: AccountStatus }) =>
  status === 'ACTIVE' ? <Badge tone="ok" icon="circle-check">Đang hoạt động</Badge> : <Badge tone="err" icon="player-pause">Tạm ngưng</Badge>

/** Thông báo thành công (MSG-FE03-16, MSG-FE03-19, MSG-FE14-02...) tự tắt sau vài giây. */
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => closeRef.current(), 6000)
    return () => clearTimeout(timer)
  }, [message])
  if (!message) return null
  return (
    <div role="status" className="fixed bottom-6 right-6 z-[60] flex max-w-[min(420px,calc(100vw-3rem))] items-start gap-2 rounded-md bg-[#183528] px-4 py-3 text-[13px] text-white shadow-lg">
      <Icon name="circle-check" size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose} className="shrink-0 text-white/80 hover:text-white"><Icon name="x" size={14} /></button>
    </div>
  )
}

/** Chỉ SA vào được các trang này; vai trò khác thấy MSG-COM-01 và nội dung không được dựng. */
export function SaPage({ title, children }: { title: string; children: ReactNode }) {
  const session = useSession()
  const allowed = !session || session.role === 'SA'
  return (
    <Layout title={title}>
      {allowed ? children : <Note tone="err">{MSG.forbidden}</Note>}
    </Layout>
  )
}


export const restPathId = (rest: string | undefined) => Number((rest ?? '').split('/')[0]) || null

/** From xl (1280 px) the detail panel sits beside the list; below it the panel is under the list and must be scrolled to. */
export const wideScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1280px)').matches

/** Giữ ?q= và các query khác nhưng bỏ ?m= khi chọn một dòng khác. */
export function searchWithoutModal(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  next.delete('m')
  const text = next.toString()
  return text ? `?${text}` : ''
}
