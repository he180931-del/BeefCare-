import { useState } from 'react'
import { Card, Segmented, Table, Td, Th } from '../../../shared/ui'
import { PERMISSION_AREAS } from '../../../shared/domain/farmRolePermissions'
import { FARM_ROLE_LABEL } from '../domain/profileRules'

const ROLES = ['OWNER', 'MANAGER', 'TECHNICIAN'] as const
type FarmRole = (typeof ROLES)[number]

function conciseAction(level: 'full' | 'view', detail: string | null) {
  if (level === 'view') return 'Xem'
  if (detail?.includes('Lập lịch')) return 'Lập lịch, ghi, sửa'
  if (detail?.includes('Ghi và sửa')) return 'Ghi, sửa'
  if (detail?.startsWith('Viết')) return 'Gửi thông báo'
  if (detail?.startsWith('Ghi, xác nhận')) return 'Ghi, xác nhận, hủy'
  return 'Quản lý'
}

export function RolePermissionsPanel() {
  const [role, setRole] = useState<FarmRole>('OWNER')

  return (
    <>
      <div className="mb-6 max-w-2xl"><h1 className="m-0 text-3xl font-bold tracking-[-0.03em] text-brand-dark sm:text-4xl">Quyền theo vai trò</h1></div>
      <div className="flex flex-col gap-4">
        <Segmented value={role} onChange={(value) => setRole(value as FarmRole)} options={ROLES.map((value) => ({ value, label: FARM_ROLE_LABEL[value] }))} className="self-start" />
        <Card title={FARM_ROLE_LABEL[role]} variant="panel">
          <Table wide>
            <thead><tr><Th className="w-[38%] min-w-[240px]">Chức năng</Th><Th>Quyền</Th></tr></thead>
            <tbody>
              {PERMISSION_AREAS.filter((area) => area.access[role].level !== 'none').map((area) => {
                const permission = area.access[role]
                return <tr key={area.code}><Td className="font-semibold text-brand-dark">{area.label}</Td><Td className="font-medium text-muted">{conciseAction(permission.level as 'full' | 'view', permission.text)}</Td></tr>
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
