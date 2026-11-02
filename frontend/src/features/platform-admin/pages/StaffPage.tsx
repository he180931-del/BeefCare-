import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { platformAdminApi } from '../api/platformAdminApi'
import AccessDialog from '../components/AccessDialog'
import PickAccountDialog from '../components/PickAccountDialog'
import { AccessStatusBadge, PersonCell, SaPage, Toast, errorMessage, restPathId } from '../components/common'
import { ROLE_LABEL } from '../domain/platformRules'

const TITLE = 'Quyền nhân sự nền tảng'
type Tab = 'all' | 'ACTIVE' | 'REVOKED'

function StaffContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const [m, , closeModal] = useModalParam()
  const accountId = restPathId(useParams()['*'])
  const [tab, setTab] = useState<Tab>('all')
  const [toast, setToast] = useState<string | null>(null)

  const staff = useQuery(
    () => (demo === 'load-error'
      ? Promise.reject(new Error('Không tải được danh sách nhân sự nền tảng.'))
      : platformAdminApi.listAccounts({ platformRole: 'STAFF', size: 100 })),
    [demo],
  )
  const target = useQuery(
    () => (m === 'access' && accountId ? platformAdminApi.getAccount(accountId) : Promise.resolve(null)),
    [m, accountId],
  )

  const rows = staff.data?.content ?? []
  const count = (status: Tab) => (status === 'all' ? rows.length : rows.filter((a) => a.platformAccessStatus === status).length)
  const shown = tab === 'all' ? rows : rows.filter((a) => a.platformAccessStatus === tab)
  const manage = (id: number) => navigate(`/nen-tang/quyen/${id}?m=access`)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE}>
        <Button variant="primary" onClick={() => navigate('/nen-tang/quyen?m=access')}>
          <Icon name="user-plus" size={16} />
          Cấp quyền nền tảng
        </Button>
      </PageHeader>
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { value: 'all', label: `Tất cả ${count('all')}` },
          { value: 'ACTIVE', label: `Đang hoạt động ${count('ACTIVE')}` },
          { value: 'REVOKED', label: `Đã thu hồi ${count('REVOKED')}` },
        ]}
      />

      {staff.loading && !staff.data && <LoadingBlock />}
      {staff.error != null && <ErrorBlock message={userFacingError(staff.error, 'Không tải được danh sách nhân sự nền tảng.')} onRetry={staff.refetch} />}
      {staff.data && !staff.error && shown.length === 0 && <EmptyBlock title="Chưa có nhân sự nền tảng" sub={'Chọn "Cấp quyền nền tảng" để thêm CS, PM hoặc SA.'} />}
      {staff.data && !staff.error && shown.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr><Th>Nhân sự</Th><Th>Vai trò</Th><Th>Trạng thái quyền</Th><Th>Tài khoản</Th><Th>Thao tác</Th></tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <Td><PersonCell name={a.fullName} sub={a.email} /></Td>
                  <Td>{a.platformRole ? ROLE_LABEL[a.platformRole] : '—'}</Td>
                  <Td><AccessStatusBadge status={a.platformAccessStatus} /></Td>
                  <Td>{a.accountStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}</Td>
                  <Td><Button size="sm" onClick={() => manage(a.id)} aria-label={`Quản lý quyền của ${a.fullName}`}>Quản lý quyền</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Foot>Hộp thoại cấp quyền nền tảng (SA). Chỉ cấp cho người đã đăng nhập Google ít nhất một lần; mỗi người tối đa một vai trò đang hoạt động. Không thu hồi được quyền SA cuối cùng. Quyền nền tảng không cho vào dữ liệu bất kỳ trang trại nào.</Foot>

      {m === 'access' && !accountId && <PickAccountDialog onClose={closeModal} />}
      {m === 'access' && accountId && target.data && (
        <AccessDialog
          account={target.data}
          onClose={closeModal}
          onReload={() => { target.refetch(); staff.refetch() }}
          onDone={(message) => { closeModal(); setToast(message); target.refetch(); staff.refetch() }}
        />
      )}
      {m === 'access' && accountId && target.error != null && <Note tone="err">{errorMessage(target.error, 'Không tải được tài khoản.')}</Note>}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function StaffPage() {
  return <SaPage title={TITLE}><StaffContent /></SaPage>
}
