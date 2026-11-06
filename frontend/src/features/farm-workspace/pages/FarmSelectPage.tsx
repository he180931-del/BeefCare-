import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Button, EmptyBlock, ErrorBlock, Foot, LoadingBlock, PageHeader } from '../../../components/ui'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { FarmCard } from '../components/FarmCard'
import SetupLayout from '../components/SetupLayout'

/** SCR-09. `?demo=empty` và `?demo=load-error` hiện hai trạng thái không có dữ liệu (mô phỏng). */
export default function FarmSelectPage() {
  const navigate = useNavigate()
  const demo = useDemoState()
  const query = useQuery(async () => {
    if (demo === 'load-error') throw new Error('Không tải được danh sách trang trại.')
    return demo === 'empty' ? [] : farmWorkspaceApi.listFarms()
  }, [demo])
  const farms = query.data ?? []
  return (
    <SetupLayout
      eyebrow="Chọn không gian" heading="Chọn đúng trại để bắt đầu"
      lines={['Mỗi trại có dữ liệu, thành viên và trạng thái dịch vụ riêng. Chọn một thẻ để tiếp tục.', 'Vai trò, quy mô đàn và dịch vụ hiện tại được ghi trên từng thẻ.']}
      badge={farms.length ? `${farms.length} trang trại bạn có quyền truy cập` : undefined}
    >
      <PageHeader title="Chọn trang trại">
        <Button onClick={() => navigate('/dang-ky-trai')}>Đăng ký trại mới</Button>
      </PageHeader>
      {query.loading && !query.data && <LoadingBlock />}
      {Boolean(query.error) && <ErrorBlock message={userFacingError(query.error, 'Không tải được danh sách trang trại. Kiểm tra kết nối rồi thử lại.')} onRetry={query.refetch} />}
      {!query.loading && !query.error && farms.length === 0 && (
        <EmptyBlock title="Tài khoản chưa liên kết với trang trại nào" sub="Đăng ký trang trại của bạn, hoặc mở lời mời đã gửi tới email." action={<Button variant="primary" onClick={() => navigate('/dang-ky-trai')}>Đăng ký trang trại</Button>} />
      )}
      <div className="grid gap-4 xl:grid-cols-2">{farms.map((farm) => <FarmCard key={farm.id} farm={farm} onOpen={navigate} />)}</div>
      <Foot>Chọn trại theo vai trò và trạng thái dịch vụ; dữ liệu giữa các trại được tách riêng.</Foot>
    </SetupLayout>
  )
}
