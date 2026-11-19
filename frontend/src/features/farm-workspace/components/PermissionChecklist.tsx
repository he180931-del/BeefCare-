import { permissionRowsFor } from '../domain/rolePermissions'
import { ROLE_SUMMARY } from '../domain/rolePermissions'
import type { FarmRole } from '../types'

const box = (on: boolean, color: string) => (
  <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none size-3.5 shrink-0" style={{ accentColor: color }} />
)

/** Danh sách quyền cố định của vai trò (GBR-06). Quản lý/Kỹ thuật viên: nhóm "Chỉ Chủ trại" luôn bỏ chọn. */
export function PermissionChecklist({ role }: { role: FarmRole }) {
  const rows = permissionRowsFor(role === 'OWNER' ? 'OWNER' : role)
  const own = rows.filter((row) => !row.ownerOnly)
  const ownerOnly = PERMISSION_OWNER_ONLY
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex flex-col gap-2.5">
        {own.map((row) => <label key={row.label} className="flex items-center gap-2 text-[#212121]">{box(row.level !== 'none', '#454545')}{row.label}{row.level === 'view' && <span className="text-[11px] text-muted">· chỉ xem</span>}</label>)}
      </div>
      {role !== 'OWNER' && (
        <>
          <p className="m-0 text-xs font-semibold text-muted">Chỉ Chủ trại</p>
          <div className="flex flex-col gap-2.5">
            {ownerOnly().map((label) => <label key={label} className="flex items-center gap-2 text-[#212121]">{box(false, '#8f8f8f')}{label}</label>)}
          </div>
        </>
      )}
    </div>
  )
}

const PERMISSION_OWNER_ONLY = () => permissionRowsFor('OWNER').filter((row) => row.ownerOnly).map((row) => row.label)

/** Tóm tắt quyền của lời mời (khung xanh như Figma "Chấp nhận lời mời"). */
export function RoleSummary({ role }: { role: Exclude<FarmRole, 'OWNER'> }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-ink">
      {ROLE_SUMMARY[role].map((line) => <li key={line} className="flex items-center gap-2">{box(true, '#08734e')}{line}</li>)}
    </ul>
  )
}
