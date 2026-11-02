import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import type { Membership } from '../types'
import { formatMonth, roleLabel } from './WorkspaceUi'

/** Danh sách thành viên (SCR-13). Cột "Thao tác" và nút chỉ có cho Chủ trại; Quản lý chỉ đọc. */
export function MemberTable({ members, owner, farmActive, onChange }: {
  members: Membership[]; owner: boolean; farmActive: boolean; onChange: (member: Membership, action: 'CHANGE_ROLE' | 'DEACTIVATE' | 'REACTIVATE') => void
}) {
  return (
    <Table>
      <thead><tr><Th>Thành viên</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Tham gia</Th>{owner && <Th>Thao tác</Th>}</tr></thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id}>
            <Td><strong className="block text-xs font-medium">{member.fullName || 'Chưa có tên'}</strong><span className="text-[11px] text-muted">{member.email}</span></Td>
            <Td>{roleLabel(member.role)}</Td>
            <Td><Badge tone={member.status === 'ACTIVE' ? 'ok' : undefined}>{member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge></Td>
            <Td>{formatMonth(member.joinedAt)}</Td>
            {owner && (
              <Td>
                {member.role === 'OWNER' ? '—' : member.status === 'ACTIVE'
                  ? <span className="inline-flex flex-wrap items-center"><Button variant="link" size="sm" disabled={!farmActive} onClick={() => onChange(member, 'CHANGE_ROLE')}>Đổi vai trò</Button>·<Button variant="link" size="sm" onClick={() => onChange(member, 'DEACTIVATE')}>Ngừng</Button></span>
                  : <Button variant="link" size="sm" disabled={!farmActive} onClick={() => onChange(member, 'REACTIVATE')}>Kích hoạt lại</Button>}
              </Td>
            )}
          </tr>
        ))}
        {!members.length && <tr><Td colSpan={owner ? 5 : 4} className="py-8 text-center text-subtle">Không có thành viên trong nhóm này.</Td></tr>}
      </tbody>
    </Table>
  )
}
