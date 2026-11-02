import { useEffect, useRef, type ReactNode } from 'react'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Note } from '../../../components/ui'
import { useSession } from '../../authorization'
import { MSG, PlatformAdminError, initials } from '../domain/platformRules'
import type { AccountStatus, PlatformAccessStatus } from '../types'

export const errorMessage = (error: unknown, fallback = 'Không thể lưu dữ liệu. Vui lòng thử lại.') =>
  error instanceof PlatformAdminError ? error.message : userFacingError(error, fallback)

export const isStale = (error: unknown) => error instanceof PlatformAdminError && error.code === 'STALE'

export function Avatar({ name, system }: { name: string; system?: boolean }) {
  return (
    <span aria-hidden className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#eef4ef] text-[9px] font-semibold text-brand">
      {system ? <Icon name="user-cog" size={12} /> : initials(name)}
    </span>
  )
}

export function PersonCell({ name, sub, system }: { name: string; sub?: string; system?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar name={name} system={system} />
      <div className="min-w-0 text-left">
        <div className="truncate text-xs font-medium text-ink">{name}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  )
}

export const AccountStatusBadge = ({ status }: { status: AccountStatus }) =>
  status === 'ACTIVE' ? <Badge tone="ok" icon="circle-check">Đang hoạt động</Badge> : <Badge tone="err" icon="player-pause">Tạm khóa</Badge>

export const AccessStatusBadge = ({ status }: { status: PlatformAccessStatus | null }) =>
  status === 'ACTIVE' ? <Badge tone="ok" icon="circle-check">Đang hoạt động</Badge> : status === 'REVOKED' ? <Badge tone="warn" icon="ban">Đã thu hồi</Badge> : <Badge tone="outline">Chưa có quyền</Badge>

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

export function downloadTextFile(name: string, text: string) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const restPathId = (rest: string | undefined) => Number((rest ?? '').split('/')[0]) || null

/** Giữ ?q= và các query khác nhưng bỏ ?m= khi chọn một dòng khác. */
export function searchWithoutModal(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  next.delete('m')
  const text = next.toString()
  return text ? `?${text}` : ''
}
