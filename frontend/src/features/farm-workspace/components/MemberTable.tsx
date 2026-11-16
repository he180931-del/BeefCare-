import type { ReactNode } from 'react'
import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import type { MemberAction, Membership } from '../types'
import { formatMonth, roleLabel } from './WorkspaceUi'

/**
 * Danh sách thành viên (SCR-13, D29). Cột "Thao tác" chỉ có cho Chủ trại; nút theo trạng thái dòng và chỉ bấm được khi
 * máy chủ trả thao tác đó trong `actions` (đổi vai trò / kích hoạt lại cần trại ACTIVE; Ngưng luôn được).
 */
export function MemberTable({ members, owner, timeZone, dir, onSort, onChange, empty }: {
  members: Membership[]; owner: boolean; timeZone: string; dir: 'asc' | 'desc'; onSort: () => void
  onChange: (member: Membership, action: MemberAction) => void; empty: ReactNode
}) {
  const can = (member: Membership, action: MemberAction) => member.actions.includes(action)
  return (
    <Table>
      <thead><tr>
        <Th aria-sort={dir === 'asc' ? 'ascending' : 'descending'}><button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={onSort}>Thành viên <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span></button></Th>
        <Th>Vai trò</Th><Th>Trạng thái</Th><Th>Tham gia</Th>{owner && <Th>Thao tác</Th>}
      </tr></thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id}>
            <Td><strong className="block text-xs font-medium">{member.fullName.trim() || 'Chưa có tên'}</strong><span className="text-[11px] text-muted">{member.email}</span></Td>
            <Td>{roleLabel(member.role)}</Td>
            <Td><Badge tone={member.status === 'ACTIVE' ? 'ok' : undefined}>{member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ngưng'}</Badge></Td>
            <Td>{formatMonth(member.joinedAt, timeZone)}</Td>
            {owner && (
              <Td>
                {member.role === 'OWNER' ? '—' : member.status === 'ACTIVE'
                  ? <span className="inline-flex flex-wrap items-center"><Button variant="link" size="sm" disabled={!can(member, 'CHANGE_ROLE')} onClick={() => onChange(member, 'CHANGE_ROLE')}>Đổi vai trò</Button>·<Button variant="link" size="sm" disabled={!can(member, 'DEACTIVATE')} onClick={() => onChange(member, 'DEACTIVATE')}>Ngưng</Button></span>
                  : <Button variant="link" size="sm" disabled={!can(member, 'REACTIVATE')} onClick={() => onChange(member, 'REACTIVATE')}>Kích hoạt lại</Button>}
              </Td>
            )}
          </tr>
        ))}
        {!members.length && <tr><Td colSpan={owner ? 5 : 4} className="py-8 text-center text-subtle">{empty}</Td></tr>}
      </tbody>
    </Table>
  )
}
