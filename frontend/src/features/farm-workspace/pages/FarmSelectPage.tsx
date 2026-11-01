import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Note, PageHeader } from '../../../components/ui'
import Layout from '../../../components/Layout'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { backendMode } from '../../../api/backendTransport'
import { roleLabel, serviceLabel } from '../components/WorkspaceUi'

const tone = (status: string) => status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'err' : 'warn'
const farmIdPath = (id: number, suffix: string) => `${suffix}?farmId=${id}`
const unavailable = 'Chưa có dữ liệu từ máy chủ'

export default function FarmSelectPage() {
  const navigate = useNavigate()
  const query = useQuery(async () => {
    const [farmResult, profileResult] = await Promise.allSettled([farmWorkspaceApi.listFarms(), farmWorkspaceApi.getProfile()])
    if (farmResult.status === 'rejected') throw farmResult.reason
    return { farms: farmResult.value, profile: profileResult.status === 'fulfilled' ? profileResult.value : null }
  }, [])
  const farms = query.data?.farms ?? []
  const profile = query.data?.profile
  return <Layout title="Chọn trang trại">
    <PageHeader title="Trang trại của tôi" sub={profile ? `${profile.fullName} · ${profile.email}` : 'Chọn trang trại để tiếp tục làm việc.'}>
      <Button variant="primary" onClick={() => navigate('/dang-ky-trai')}>+ Đăng ký trại mới</Button>
    </PageHeader>
    {backendMode === 'local' && <Note tone="info">Bạn đang xem dữ liệu mô phỏng. Các thay đổi chỉ nằm trong phiên trình duyệt này.</Note>}
    {query.loading && !query.data && <Note>Đang tải danh sách trang trại…</Note>}
    {Boolean(query.error) && <Note tone="err">Không tải được danh sách trang trại. Kiểm tra kết nối rồi thử lại.</Note>}
    {farms.length === 0 && !query.loading && !query.error && <Card title="Chưa có trang trại"><p className="m-0 text-sm text-subtle">Đăng ký trang trại để bắt đầu thiết lập BeefCare.</p><Button variant="primary" onClick={() => navigate('/dang-ky-trai')}>Đăng ký trang trại</Button></Card>}
    <div className="grid gap-4 xl:grid-cols-2">{farms.map((farm) => {
      const owner = farm.role === 'OWNER'
      const active = farm.serviceStatus === 'ACTIVE'
      const action = active ? 'Vào trang trại' : farm.serviceStatus === 'PENDING_PAYMENT' ? 'Thanh toán để kích hoạt' : farm.serviceStatus === 'EXPIRED' ? 'Gia hạn dịch vụ' : 'Liên hệ hỗ trợ'
      const onEnter = () => navigate(active ? farmIdPath(farm.id, '/tong-quan') : farm.serviceStatus === 'SUSPENDED' ? farmIdPath(farm.id, '/ho-tro') : farmIdPath(farm.id, '/goi-dich-vu'))
      return <Card key={farm.id} title={farm.name} sub={`${farm.commune ?? unavailable}${farm.province ? `, ${farm.province}` : ''}`} actions={<Badge tone={tone(farm.serviceStatus)}>{serviceLabel(farm.serviceStatus)}</Badge>}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="block text-faint">Vai trò của bạn</span><strong>{roleLabel(farm.role)}</strong></div>
          <div><span className="block text-faint">Đàn bò đang hoạt động</span><strong>{farm.activeCattleCount == null ? unavailable : `${farm.activeCattleCount} con`}</strong></div>
          <div><span className="block text-faint">Dịch vụ đến</span><strong>{farm.serviceUntil ? new Intl.DateTimeFormat('vi-VN').format(new Date(farm.serviceUntil)) : unavailable}</strong></div>
        </div>
        {!active && !owner && <Note tone="warn">Chủ trại quản lý gói dịch vụ. Trang trại hiện chưa thể truy cập.</Note>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="primary" disabled={!active && !owner} onClick={onEnter}>{action}</Button></div>
      </Card>
    })}</div>
  </Layout>
}
