import { useState } from 'react'
import { Segmented, Table, Td, Th } from '../../../shared/ui'
import { PERMISSION_AREAS } from '../../../shared/domain/farmRolePermissions'
import { FARM_ROLE_LABEL } from '../domain/profileRules'

const ROLES = ['OWNER', 'MANAGER', 'TECHNICIAN'] as const
type FarmRole = (typeof ROLES)[number]

const ROLE_DESCRIPTION: Record<FarmRole, string> = {
  OWNER: 'Chủ trại có quyền quản lý toàn bộ hoạt động trang trại.',
  MANAGER: 'Quản lý điều hành hoạt động được Chủ trại phân công.',
  TECHNICIAN: 'Kỹ thuật viên ghi nhận và cập nhật công việc chăm sóc đàn bò.',
}

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
      <div className="mb-5 max-w-2xl"><h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-brand-dark">Quyền theo vai trò</h1></div>
      <div className="flex flex-col gap-4">
        <section data-testid="permissions-bento-role" className="rounded-2xl border border-field bg-white p-4">
          <Segmented value={role} onChange={(value) => setRole(value as FarmRole)} options={ROLES.map((value) => ({ value, label: FARM_ROLE_LABEL[value] }))} className="[&>button[aria-pressed=true]]:border-[#bcd5c5] [&>button[aria-pressed=true]]:bg-[#ddece2] [&>button[aria-pressed=true]]:text-brand-dark" />
          <p className="mb-0 mt-3 text-sm leading-6 text-ink">{ROLE_DESCRIPTION[role]}</p>
        </section>
        <section data-testid="permissions-bento-matrix" className="min-w-0 rounded-2xl border border-field bg-white p-4">
          <Table narrow>
            <thead><tr><Th className="w-[72%]">Chức năng</Th><Th>Quyền</Th></tr></thead>
            <tbody>
              {PERMISSION_AREAS.filter((area) => area.access[role].level !== 'none').map((area) => {
                const permission = area.access[role]
                return <tr key={area.code}><Td className="font-semibold text-brand-dark">{area.label}</Td><Td className="font-medium text-muted">{conciseAction(permission.level as 'full' | 'view', permission.text)}</Td></tr>
              })}
            </tbody>
          </Table>
        </section>
      </div>
    </>
  )
}
