import { Table, Td, Th } from '../../../components/ui'
import { PERMISSION_AREAS, ROLE_SUMMARY } from '../domain/rolePermissions'
import type { FarmRole } from '../types'
import { roleLabel } from './WorkspaceUi'

const box = (on: boolean, color: string) => (
  <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none mt-0.5 size-3.5 shrink-0" style={{ accentColor: color }} />
)

/**
 * Quyền cố định của một vai trò theo Table III-2 (GBR-06), dùng ở popup Mời: các nhóm có quyền kèm nội dung ô của SRS,
 * rồi các nhóm vai trò này không có quyền.
 */
export function PermissionChecklist({ role }: { role: FarmRole }) {
  const rows = PERMISSION_AREAS.map((area) => ({ label: area.label, text: area.access[role].text }))
  const granted = rows.filter((row) => row.text !== null)
  const denied = rows.filter((row) => row.text === null)
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex flex-col gap-2.5">
        {granted.map((row) => <label key={row.label} className="flex items-start gap-2 text-[#212121]">{box(true, '#454545')}<span>{row.label}<span className="text-[11px] text-muted"> · {row.text}</span></span></label>)}
      </div>
      {denied.length > 0 && (
        <>
          <p className="m-0 text-xs font-semibold text-muted">Không có quyền</p>
          <div className="flex flex-col gap-2.5">
            {denied.map((row) => <label key={row.label} className="flex items-start gap-2 text-[#212121]">{box(false, '#8f8f8f')}{row.label}</label>)}
          </div>
        </>
      )}
    </div>
  )
}

const ROLES: FarmRole[] = ['OWNER', 'MANAGER', 'TECHNICIAN']

/** SCR-13 "Quyền theo vai trò" (D29): toàn bộ Table III-2, chỉ đọc, ba vai trò cạnh nhau; điện thoại hiện dạng thẻ. */
export function PermissionTable() {
  return (
    <Table>
      <thead><tr><Th>Nhóm quyền</Th>{ROLES.map((role) => <Th key={role}>{roleLabel(role)}</Th>)}</tr></thead>
      <tbody>
        {PERMISSION_AREAS.map((area) => (
          <tr key={area.code}>
            <Td><strong className="font-medium">{area.label}</strong></Td>
            {ROLES.map((role) => <Td key={role} className={area.access[role].text ? undefined : 'text-subtle'}>{area.access[role].text ?? '—'}</Td>)}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

/** Tóm tắt quyền của lời mời (khung xanh như Figma "Chấp nhận lời mời"). */
export function RoleSummary({ role }: { role: Exclude<FarmRole, 'OWNER'> }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-ink">
      {ROLE_SUMMARY[role].map((line) => <li key={line} className="flex items-center gap-2">{box(true, '#08734e')}{line}</li>)}
    </ul>
  )
}

